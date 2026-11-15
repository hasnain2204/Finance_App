import { formatCurrency, fromPaisa } from '../../lib/finance';

export function MigrationVerificationSummary({ report }) {
  if (!report) return null;
  const amountComparison = (comparison) => (
    `${formatCurrency(fromPaisa(comparison.source))} source · ` +
    `${formatCurrency(fromPaisa(comparison.destination))} SQLite · ` +
    `${comparison.matches ? 'matched' : 'mismatch'}`
  );

  return (
    <section className="panel migration-verification-card" aria-labelledby="migration-verification-title">
      <h2 id="migration-verification-title">
        {report.verified ? 'Migration verification passed' : 'Migration verification needs review'}
      </h2>
      <p>Imported backup version {report.version}. Amounts are compared in integer paisa.</p>
      <ul>
        {Object.entries(report.counts).map(([collection, comparison]) => (
          <li key={collection}>
            <strong>{collection}:</strong>{' '}
            {comparison.comparable
              ? `${comparison.source} source · ${comparison.destination} SQLite`
              : `${comparison.destination} SQLite · not included in this legacy backup`}
          </li>
        ))}
      </ul>
      <p>Expense total: {amountComparison(report.financial.expenseTotalPaisa)}</p>
      <p>Cumulative budget: {amountComparison(report.financial.cumulativeBudgetTotalPaisa)}</p>
      <p>
        Relationships: {report.references.matched
          ? `${report.references.sourceCount} resolved and matched`
          : 'relationship verification failed'} · Stable IDs matched: {report.identities.syncIdsMatched}/{report.identities.sourceRecords}
      </p>
      {report.skippedIncomeCount ? (
        <p>{report.skippedIncomeCount} income transaction(s) were skipped according to the existing backup restore rules.</p>
      ) : null}
      {report.warnings.length ? (
        <ul>{report.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul>
      ) : null}
    </section>
  );
}
