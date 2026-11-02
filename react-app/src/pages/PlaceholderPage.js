import { Card, Chip, PageHeader } from '../components/ui';

export default function PlaceholderPage({ title, blurb, replaces = [] }) {
  return (
    <div className="dash">
      <PageHeader eyebrow="Coming soon" title={title} subtitle={blurb} />
      {replaces.length > 0 && (
        <Card title="Replaces these Creator screens">
          <div className="tags tags-lg">{replaces.map((r) => <Chip key={r} value={r} tone="gray" />)}</div>
        </Card>
      )}
    </div>
  );
}
