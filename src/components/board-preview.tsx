"use client";

/**
 * Prévia de como a placa aparece no app: abaixo do vídeo do desafio, como as
 * placas de publicidade na beira do campo. Sem arte, mostra o "Anuncie aqui".
 */
export function BoardPreview({ mediaUrl, width = 1200, height = 200 }: { mediaUrl: string; width?: number; height?: number }) {
  return (
    <div className="mx-auto w-full max-w-[18rem] rounded-[2rem] border-4 border-surface-2 bg-black p-2 shadow-xl">
      <div className="overflow-hidden rounded-[1.5rem] bg-bg">
        <div className="flex items-center gap-2 px-3 py-2 text-[10px] text-muted">
          <span className="size-5 rounded-full bg-surface-2" />
          <span className="font-semibold text-ink">@skater</span>
          <span>desafiou a galera</span>
        </div>
        <div className="flex aspect-[4/5] items-center justify-center bg-gradient-to-b from-surface-2 to-black">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/15 text-xl text-white">▶</span>
        </div>
        <div className="border-y border-line bg-black" style={{ aspectRatio: `${width} / ${height}` }}>
          {mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="Arte da placa" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center gap-2 bg-brand text-[11px] font-bold tracking-wide text-white uppercase">
              Anuncie aqui · skatego.com.br/anuncie
            </div>
          )}
        </div>
        <div className="flex gap-3 px-3 py-3">
          <span className="h-2 w-16 rounded bg-surface-2" />
          <span className="h-2 w-10 rounded bg-surface-2" />
        </div>
      </div>
    </div>
  );
}
