import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownDocument({ content }: { content: string }) {
  return (
    <div className="max-w-none break-words text-slate-800 [&_a]:font-semibold [&_a]:text-cyan-800 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-cyan-200 [&_blockquote]:pl-4 [&_blockquote]:text-slate-600 [&_h1]:mt-8 [&_h1]:text-3xl [&_h1]:font-black [&_h1]:tracking-tight [&_h1:first-child]:mt-0 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_p]:my-4 [&_p]:leading-7 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-slate-50 [&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:p-3 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-100 [&_th]:p-3 [&_th]:text-left [&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
