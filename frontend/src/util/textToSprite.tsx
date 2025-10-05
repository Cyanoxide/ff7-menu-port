const textToSprite = (text: string, isResourceValue: boolean = false, isHighlight = false) => {
    if (!text) return;

    return (
        <span className={`font flex`} data-label={(isResourceValue) ? "resourceValue" : null} data-highlighted={isHighlight ? true : null}>
            {text.split("").map((glyph: string, index: number) => (
                <span key={index} className="font-glyph" data-sprite={glyph}>{glyph}</span>
            ))}
        </span>
    )
}
export default textToSprite;
