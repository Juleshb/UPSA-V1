export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items]

  return (
    <div className="marquee" aria-label="Platform signals">
      <div className="marquee-track">
        {row.map((item, index) => (
          <span key={`${item}-${index}`}>
            <i />
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
