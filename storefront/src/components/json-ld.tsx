interface JsonLdProps {
  data: Record<string, unknown>;
  id?: string;
}

/** Inserta un bloque JSON-LD. Escapa `<` para no romper el HTML. */
export function JsonLd({ data, id }: JsonLdProps): JSX.Element {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    <script
      id={id}
      type="application/ld+json"
      data-testid="json-ld"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
