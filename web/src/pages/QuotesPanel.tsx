import { RefreshCw } from 'lucide-react';
import { useSignGroups, useSyncQuotes } from '../api/queries';
import { useToast } from '../components/toast';
import { Card } from '../components/ui';

const money = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'AUD', maximumFractionDigits: 2 });

/** Quotes pulled from the CRM deal, shown as the job's priced groups. Only jobs that came from a deal can sync. */
export function QuotesPanel({ jobId, hasDeal, canSync }: { jobId: string; hasDeal: boolean; canSync: boolean }) {
	const list = useSignGroups(jobId);
	const sync = useSyncQuotes(jobId);
	const { notify } = useToast();

	const run = () =>
		sync.mutate(undefined, {
			onSuccess: (r) => notify(r.found === 0 ? 'No quotes found for this deal in the CRM' : `Quotes synced: ${r.created} new, ${r.updated} updated, ${r.unchanged} unchanged`),
		});

	return (
		<Card
			title="Quotes from CRM"
			flush
			action={
				hasDeal && canSync ? (
					<button className="btn btn-ghost" onClick={run} disabled={sync.isPending}>
						<RefreshCw size={15} aria-hidden="true" /> {sync.isPending ? 'Syncing...' : 'Sync from CRM'}
					</button>
				) : undefined
			}
		>
			{sync.isError && <p role="alert">{sync.error.message}</p>}
			{!hasDeal && <p className="table-empty">This job was not created from a CRM deal, so there are no quotes to pull.</p>}
			{hasDeal && list.isPending && <p role="status" className="table-empty">Loading...</p>}
			{hasDeal && list.isError && <p role="alert">Could not load quotes.</p>}
			{hasDeal && list.isSuccess && list.data.items.length === 0 && <p className="table-empty">No quotes saved yet. Use "Sync from CRM" once a quote exists on the deal.</p>}
			{list.isSuccess &&
				list.data.items.map((g) => (
					<div key={g.id} className="table-wrap">
						<table className="table">
							<caption style={{ textAlign: 'left', padding: '10px 16px' }}>
								<strong>{g.name}</strong>
								{g.stage && <span className="chip chip-gray" style={{ marginLeft: 8 }}>{g.stage}</span>}
								<span className="muted" style={{ marginLeft: 8 }}>Total {money(g.totals.grandTotal)}</span>
							</caption>
							<thead>
								<tr>
									<th scope="col">Item</th>
									<th scope="col">Qty</th>
									<th scope="col">Unit price</th>
									<th scope="col">Discount</th>
									<th scope="col">Line total</th>
								</tr>
							</thead>
							<tbody>
								{g.items.map((i, n) => (
									<tr key={n}>
										<td data-label="Item" className="cell-primary">
											<strong>{i.product}</strong>
											{i.description && <div className="muted">{i.description}</div>}
										</td>
										<td data-label="Qty" className="num">{i.qty}</td>
										<td data-label="Unit price" className="num">{money(i.unitPrice)}</td>
										<td data-label="Discount" className="num">{i.discount ? money(i.discount) : '-'}</td>
										<td data-label="Line total" className="num">{money(i.total)}</td>
									</tr>
								))}
							</tbody>
						</table>
						{g.truncated && <p className="muted" style={{ padding: '4px 16px' }}>This quote has more lines than can be stored here; the list is cut short.</p>}
					</div>
				))}
		</Card>
	);
}
