import { useRef } from 'react';
import { getDownloadUrl, useFiles, useUploadFile } from '../api/queries';

const MAX_MB = 15;

/** Photos and PDFs attached to one record. Upload goes straight to storage with a short-lived link. */
export function FilesPanel({ entityType, entityId, canUpload }: { entityType: string; entityId: string; canUpload: boolean }) {
	const list = useFiles(entityType, entityId);
	const upload = useUploadFile(entityType, entityId);
	const input = useRef<HTMLInputElement>(null);

	const open = async (id: string) => {
		const { url } = await getDownloadUrl(id);
		window.open(url, '_blank', 'noopener');
	};

	return (
		<section aria-label="Files" className="files">
			<h2 className="group__title">Photos and files</h2>
			{list.isSuccess && list.data.items.length === 0 && <p>No files yet.</p>}
			{list.isError && <p role="alert">Could not load files.</p>}
			{list.isSuccess && list.data.items.length > 0 && (
				<ul className="plain-list">
					{list.data.items.map((f) => (
						<li key={f.id}>
							<button className="btn btn-ghost" onClick={() => open(f.id)}>
								{f.name}
							</button>{' '}
							<span className="q__hint">{(f.sizeBytes / 1024 / 1024).toFixed(1)} MB</span>
						</li>
					))}
				</ul>
			)}
			{canUpload && (
				<div className="actions">
					<input
						ref={input}
						type="file"
						accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
						aria-label="Choose a photo or PDF"
						disabled={upload.isPending}
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) upload.mutate(file, { onSettled: () => { if (input.current) input.current.value = ''; } });
						}}
					/>
				</div>
			)}
			{canUpload && <p className="q__hint">JPEG, PNG, WebP, HEIC or PDF, up to {MAX_MB} MB (PDF 25 MB).</p>}
			{upload.isPending && <p role="status">Uploading...</p>}
			{upload.isError && <p role="alert">{upload.error.message}</p>}
		</section>
	);
}
