const textToSprite = (text: string, isResourceValue: boolean = false, textColor: string = "white") => {
    if (!text) return;

    return (
        <span className={`font flex`} data-label={(isResourceValue) ? "resourceValue" : null} data-text-color={textColor}>
            {text.split("").map((glyph: string, index: number) => (
                <span key={index} className="font-glyph" data-sprite={glyph}>{glyph}</span>
            ))}
        </span>
    )
}
export default textToSprite;
