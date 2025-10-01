const textToSprite = (text: string, isResourceValue: boolean = false) => {
    if (!text) return;

    return (
        <span className={`font flex`} data-label={(isResourceValue) ? "resourceValue" : null}>
            {text.split("").map((glyph: string, index: number) => (
                <span key={index} className="font-glyph" data-sprite={glyph}>{glyph}</span>
            ))}
        </span>
    )
}
export default textToSprite;
