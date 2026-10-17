'use client';

const BG_SRC = '/family-log/family-log-title.png';

export function FamilyLogPreview() {
  return (
    <section className="relative h-full min-h-[10rem] overflow-hidden bg-[#fbf6ec]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={BG_SRC} alt="" draggable={false} className="h-full w-full object-cover object-top" />
    </section>
  );
}
