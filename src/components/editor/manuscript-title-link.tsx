import Link from "next/link";

export function ManuscriptTitleLink({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  return (
    <Link
      className="font-semibold text-card-foreground underline-offset-4 transition-colors duration-200 hover:text-primary hover:underline"
      href={`/dashboard/editor/manuscripts/${id}`}
    >
      {title}
    </Link>
  );
}
