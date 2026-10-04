import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Breadcrumbs } from '@/components/breadcrumbs';
import { JsonLd } from '@/components/json-ld';
import { PageImage } from '@/components/page-image';
import { getPage } from '@/lib/erp';
import { breadcrumbJsonLd } from '@/lib/jsonld';

interface StorePageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const page = await getPage(params.slug);
  if (page === null) {
    return { title: 'Pagina no encontrada', robots: { index: false, follow: false } };
  }
  const description = page.content.slice(0, 160);
  return {
    title: page.title,
    description,
    alternates: { canonical: `/paginas/${page.slug}` },
    openGraph: { title: page.title, description, type: 'article' },
  };
}

/** Pagina del CMS del ERP (`GET /storefront/pages/:slug`; 404 si esta en borrador). */
export default async function StorePage({ params }: StorePageProps): Promise<JSX.Element> {
  const page = await getPage(params.slug);
  if (page === null) {
    notFound();
  }

  const crumbs = [{ label: 'Inicio', href: '/' }, { label: page.title }];
  const paragraphs = page.content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== '');

  return (
    <article className="flex flex-col gap-6">
      <Breadcrumbs items={crumbs} />

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-fg">{page.title}</h1>
        <p className="text-xs text-fg-tertiary">
          Contenido publicado desde el ERP · actualizado el{' '}
          <time dateTime={page.updatedAt}>{new Date(page.updatedAt).toLocaleDateString('es-BO')}</time>
        </p>
      </header>

      {/*
        La imagen del CMS (`imageUrl`, contrato del canal). `PageImage` decide **todo**: una pagina
        sin imagen —o con una URL de relleno del seed y el modo demostracion apagado— no pinta
        **nada** (no hay monograma en una pagina de texto), asi que no deja hueco en el `gap` del
        articulo. El `?? null` cubre a un canal anterior al campo (`undefined` en runtime).
      */}
      <PageImage src={page.imageUrl ?? null} alt={`Imagen de la pagina: ${page.title}`} />

      <div className="flex max-w-3xl flex-col gap-3 text-sm text-fg-secondary">
        {paragraphs.map((paragraph, index) => (
          <p key={`parrafo-${index}`}>{paragraph}</p>
        ))}
      </div>

      <JsonLd data={breadcrumbJsonLd(crumbs)} id="jsonld-pagina" />
    </article>
  );
}
