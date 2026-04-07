import { SectionIntro } from '@hominem/ui';

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
      <header className="border-b border-border/30 pb-6">
        <SectionIntro eyebrow={eyebrow} title={title} description={description} />
      </header>
    </section>
  );
}
