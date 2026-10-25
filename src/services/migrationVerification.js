import {
  calculateCumulativeBudgetTotal,
  calculateExpenseTotal
} from '../lib/finance';

export const financeCollectionNames = [
  'transactions',
  'categories',
  'paymentMethods',
  'budgets',
  'budgetHistory',
  'preferences'
];

const relationshipDefinitions = [
  ['transactions', 'categoryId', 'categorySyncId', 'categories'],
  ['transactions', 'paymentMethodId', 'paymentMethodSyncId', 'paymentMethods'],
  ['budgets', 'categoryId', 'categorySyncId', 'categories'],
  ['budgetHistory', 'categoryId', 'categorySyncId', 'categories']
];

function sourceCollection(data, name) {
  if (name === 'preferences' && data.preferences === null) return null;
  return data[name] || [];
}

function collectRelationships(data) {
  const relationships = [];
  for (const [store, localField, syncField, targetStore] of relationshipDefinitions) {
    for (const record of data[store] || []) {
      if (
        (store === 'budgets' || store === 'budgetHistory') &&
        (!record[localField] || record[localField] === 'overall')
      ) continue;
      relationships.push({
        store,
        recordSyncId: record.syncId,
        localField,
        syncField,
        targetStore,
        localId: record[localField],
        syncId: record[syncField] || null
      });
    }
  }
  return relationships;
}

function relationshipKey(reference) {
  return [
    reference.store,
    reference.recordSyncId,
    reference.syncField,
    reference.syncId,
    String(reference.localId)
  ].join('|');
}

export function createMigrationVerificationReport({
  version,
  sourceData,
  destinationData,
  skippedIncomeCount = 0,
  warnings = []
}) {
  const counts = Object.fromEntries(financeCollectionNames.map((name) => {
    const sourceRecords = sourceCollection(sourceData, name);
    const destinationRecords = destinationData[name] || [];
    return [name, {
      source: sourceRecords === null ? null : sourceRecords.length,
      destination: destinationRecords.length,
      comparable: sourceRecords !== null,
      matches: sourceRecords === null ? null : sourceRecords.length === destinationRecords.length
    }];
  }));

  const identityRows = financeCollectionNames.flatMap((name) => (
    (sourceCollection(sourceData, name) || []).map((record) => ({ store: name, record }))
  ));
  const destinationByIdentity = new Map(financeCollectionNames.flatMap((name) => (
    (destinationData[name] || []).map((record) => [`${name}:${record.syncId}`, record])
  )));
  const missingSyncIds = [];
  const localIdMismatches = [];
  let localIdsCompared = 0;
  let localIdsPreserved = 0;
  for (const { store, record } of identityRows) {
    const destination = destinationByIdentity.get(`${store}:${record.syncId}`);
    if (!destination) {
      missingSyncIds.push({ store, syncId: record.syncId || null, id: record.id ?? null });
      continue;
    }
    if (record.id !== undefined) {
      localIdsCompared += 1;
      if (destination.id === record.id) localIdsPreserved += 1;
      else localIdMismatches.push({ store, syncId: record.syncId, sourceId: record.id, destinationId: destination.id });
    }
  }

  const sourceRelationships = collectRelationships(sourceData);
  const destinationRelationships = collectRelationships(destinationData);
  const sourceRelationshipKeys = sourceRelationships.map(relationshipKey).sort();
  const destinationRelationshipKeys = destinationRelationships.map(relationshipKey).sort();
  const destinationTargets = Object.fromEntries(['categories', 'paymentMethods'].map((name) => [
    name,
    new Map((destinationData[name] || []).map((record) => [record.syncId, record]))
  ]));
  const unresolvedDestination = destinationRelationships.filter((reference) => {
    const target = destinationTargets[reference.targetStore]?.get(reference.syncId);
    return !target || target.id !== reference.localId;
  });
  const referencesMatch = sourceRelationshipKeys.length === destinationRelationshipKeys.length &&
    sourceRelationshipKeys.every((key, index) => key === destinationRelationshipKeys[index]);

  const financial = {
    expenseTotalPaisa: {
      source: calculateExpenseTotal(sourceData.transactions || []),
      destination: calculateExpenseTotal(destinationData.transactions || []),
      matches: calculateExpenseTotal(sourceData.transactions || []) ===
        calculateExpenseTotal(destinationData.transactions || [])
    },
    cumulativeBudgetTotalPaisa: {
      source: calculateCumulativeBudgetTotal(sourceData.budgets || [], sourceData.budgetHistory || []),
      destination: calculateCumulativeBudgetTotal(destinationData.budgets || [], destinationData.budgetHistory || []),
      matches: calculateCumulativeBudgetTotal(sourceData.budgets || [], sourceData.budgetHistory || []) ===
        calculateCumulativeBudgetTotal(destinationData.budgets || [], destinationData.budgetHistory || [])
    }
  };

  const countsMatch = Object.values(counts).every((comparison) => (
    !comparison.comparable || comparison.matches
  ));
  const verified = countsMatch && missingSyncIds.length === 0 && localIdMismatches.length === 0 &&
    unresolvedDestination.length === 0 && referencesMatch &&
    financial.expenseTotalPaisa.matches && financial.cumulativeBudgetTotalPaisa.matches;

  return {
    version,
    verified,
    counts,
    identities: {
      sourceRecords: identityRows.length,
      syncIdsMatched: identityRows.length - missingSyncIds.length,
      missingSyncIds,
      localIdsCompared,
      localIdsPreserved,
      localIdMismatches
    },
    references: {
      sourceCount: sourceRelationships.length,
      destinationCount: destinationRelationships.length,
      matched: referencesMatch,
      unresolvedDestination
    },
    financial,
    skippedIncomeCount,
    warnings: [...warnings]
  };
}
