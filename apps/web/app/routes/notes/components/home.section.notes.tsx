export default function NotesHomeSection({
  eyebrow = 'Notes',
  title = 'Browse notes as one living stream instead of a pile of separate records.',
  description = 'The notes view should feel like the same product as home: capture at the top, recent context nearby, and the rest of your writing in one calm chronology.',
}: {
  title: string;
  description: string;
  eyebrow: string;
}) {
  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 border-b border-border/30 pb-6">
        <div className="text-caption-1 uppercase tracking-widest text-text-tertiary">{eyebrow}</div>
        <div className="space-y-3">
          <h1 className="text-title-2 font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-body-3 text-text-secondary">{description}</p>
        </div>
      </header>
    </section>
  );
}
