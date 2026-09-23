import Link from 'next/link';

/** 404 de la tienda (producto no publicado, categoria inexistente, pagina en borrador). */
export default function NotFound(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-4xl font-bold text-fg-tertiary">404</p>
      <h1 className="text-xl font-semibold text-fg">No encontramos esta pagina</h1>
      <p className="max-w-md text-sm text-fg-secondary">
        Puede que el articulo no este publicado en el canal del ERP, que la categoria no exista o que
        el enlace sea viejo.
      </p>
      <ul className="flex flex-wrap justify-center gap-2">
        <li>
          <Link href="/" className="sf-btn bg-primary text-primary-fg hover:bg-primary-hover">
            Ir al inicio
          </Link>
        </li>
        <li>
          <Link href="/categorias" className="sf-btn-secondary">
            Ver categorias
          </Link>
        </li>
        <li>
          <Link href="/buscar" className="sf-btn-secondary">
            Buscar productos
          </Link>
        </li>
      </ul>
    </div>
  );
}
