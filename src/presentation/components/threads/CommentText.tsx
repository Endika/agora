import { autolink } from '@/presentation/utils/autolink'

/** Plain text with links made clickable. No HTML is produced, so nothing has to be sanitised. */
export function CommentText({ body }: { body: string }) {
  return (
    <p className="whitespace-pre-wrap break-words">
      {autolink(body).map((part, index) =>
        part.kind === 'link' ? (
          <a
            key={index}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {part.url}
          </a>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  )
}
