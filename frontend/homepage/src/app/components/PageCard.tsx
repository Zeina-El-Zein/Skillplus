import type { ReactNode } from "react";

type PageCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export default function PageCard({ eyebrow, title, description, children }: PageCardProps) {
  return (
    <section className="bg-white border border-blue-100 rounded-3xl shadow-xl shadow-blue-100/50 overflow-hidden">
      <div className="px-7 md:px-10 pt-9 pb-6 border-b border-blue-50">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-900 mb-2">
          {eyebrow}
        </p>
        <h1
          className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {title}
        </h1>
        <p className="text-gray-500 mt-3 leading-relaxed">{description}</p>
      </div>
      <div className="px-7 md:px-10 py-8">{children}</div>
    </section>
  );
}
