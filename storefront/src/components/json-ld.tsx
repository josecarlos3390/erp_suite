interface JsonLdProps {
  /**
   * El documento JSON-LD, o la **promesa** que lo produce. Las funciones de `@/lib/jsonld` son
   * asincronas desde que la URL publica se resuelve **por host** (un despliegue sirviendo varios
   * dominios publica la canónica de cada tienda), asi que se pueden pasar tal cual: este
   * componente las espera. Se acepta tambien un objeto para quien lo arme en linea.
   */
  data: Record<string, unknown> | Promise<Record<string, unknown>>;
  id?: string;
}

/** Inserta un bloque JSON-LD. Escapa `<` para no romper el HTML. */
export async function JsonLd({ data, id }: JsonLdProps): Promise<JSX.Element> {
  const resolved = await data;
  const json = JSON.stringify(resolved).replace(/</g, '\\u003c');
  return (
    <script
      id={id}
      type="application/ld+json"
      data-testid="json-ld"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
