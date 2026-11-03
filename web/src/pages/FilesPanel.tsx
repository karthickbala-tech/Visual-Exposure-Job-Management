import { useRef } from 'react';
import { FileText } from 'lucide-react';
import { getDownloadUrl, useFiles, useUploadFile } from '../api/queries';
import { useToast } from '../components/toast';
import { Card } from '../components/ui';

const MAX_MB = 15;

/** Photos and PDFs attached to one record. Upload goes straight to storage with a short-lived link. */
export function FilesPanel({ entityType, entityId, canUpload }: { entityType: string; entityId: string; canUpload: boolean }) {
	const list = useFiles(entityType, entityId);
	const upload = useUploadFile(entityType, entityId);
	const input = useRef<HTMLInputElement>(null);
	const { notify } = useToast();

	const open = async (id: string) => {
		const { url } = await getDownloadUrl(id);
		window.open(url, '_blank', 'noopener');
	};

	return (
		<Card title="Photos and files">
			{list.isSuccess && list.data.items.length === 0 && <p className="muted">No files yet.</p>}
			{list.isError && <p role="alert">Could not load files.</p>}
			{list.isSuccess && list.data.items.length > 0 && (
				<ul className="plain-list">
					{list.data.items.map((f) => (
						<li key={f.id}>
							<button className="btn btn-ghost btn-sm" onClick={() => open(f.id)}>
								<FileText size={14} aria-hidden="true" /> {f.name}
							</button>{' '}
							<small>{(f.sizeBytes / 1024 / 1024).toFixed(1)} MB</small>
						</li>
					))}
				</ul>
			)}
			{canUpload && (
				<div style={{ marginTop: 16 }}>
					<input
						ref={input}
						type="file"
						accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
						aria-label="Choose a photo or PDF"
						disabled={upload.isPending}
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) {
								upload.mutate(file, {
									onSuccess: () => notify('File uploaded'),
									onSettled: () => {
										if (input.current) input.current.value = '';
									},
								});
							}
						}}
					/>
					<p className="q__hint" style={{ marginTop: 8 }}>
						JPEG, PNG, WebP, HEIC or PDF, up to {MAX_MB} MB (PDF 25 MB).
					</p>
				</div>
			)}
			{upload.isPending && <p role="status">Uploading...</p>}
			{upload.isError && <p role="alert">{upload.error.message}</p>}
		</Card>
	);
}
