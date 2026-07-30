import textToSprite from "../../util/textToSprite.tsx";

import ProgressBar from "../ProgressBar/ProgressBar.tsx";
import ResourceCounter from "../ResourceCounter/ResourceCounter.tsx";
import partyMemberJSON from "../../data/partyMember.json";
import type { PartyMemberType } from "../../context/types.tsx";
import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import playSound from "../../util/sounds.ts";
import { useContext } from "../../context/context.tsx";
import { markKeyboardNavigation } from "../../hooks/useCursorNav.ts";
import { landingNav } from "../../hooks/landingNav.ts";
import styles from "./PartyMember.module.scss";
import ContentBox from "../ContentBox/ContentBox.tsx";
import Portrait from "../Portrait/Portrait.tsx";
import { LIMIT_SHEET, LIMIT_SHEET_SIZE, LIMIT_SLASHES, LIMIT_BOX, LIMIT_TIMING } from "../../data/limitBreak.ts";

interface partyMemberProps {
    memberId?: number,
    showProgressBars?: boolean,
    healthReduction?: boolean,
}

const PartyMember: React.FC<partyMemberProps> = ({ memberId, showProgressBars = false, healthReduction = false }) => {
    const partyMemberData = (partyMemberJSON as PartyMemberType[]).find((partyMember) => partyMember.id === memberId);
    const [isAttacking, setIsAttacking] = useState(false);
    const [isDying, setIsDying] = useState(false);
    const [damage, setDamage] = useState(0);
    // Cross Slash: how many slashes have landed, and whether they are spinning away
    const [limitHits, setLimitHits] = useState(0);
    const [limitSpinning, setLimitSpinning] = useState(false);
    const [limitCharge, setLimitCharge] = useState(100);
    const limitRunningRef = useRef(false);
    const limitTimersRef = useRef<number[]>([]);
    const { isSoundEnabled, currentHealth, currentMana, userName, dispatch } = useContext();
    const navigate = useNavigate();
    const landingFocus = useSyncExternalStore(landingNav.subscribe, landingNav.getFocus);
    const keyboardFocus = healthReduction ? landingFocus : null;
    const attackRef = useRef<() => void>(() => { });
    const reviveRef = useRef<() => void>(() => { });

    // The hits are spaced out over a second and a half, so each one needs the
    // health as it stands when it lands rather than as it was when the sequence
    // started. Context state is a snapshot in those closures; this is not.
    const healthRef = useRef(currentHealth);
    healthRef.current = currentHealth;

    useEffect(() => () => {
        limitTimersRef.current.forEach(clearTimeout);
        limitTimersRef.current = [];
    }, []);

    // Expose the avatar interactions to the landing page keyboard cursor
    useEffect(() => {
        if (!healthReduction) return;
        landingNav.actions.attack = () => attackRef.current();
        landingNav.actions.revive = () => reviveRef.current();
        return () => {
            landingNav.actions.attack = undefined;
            landingNav.actions.revive = undefined;
            landingNav.setFocus(null);
        };
    }, [healthReduction]);

    useEffect(() => {
        if (currentHealth === null) {
            dispatch({ type: "SET_CURRENT_HEALTH", payload: partyMemberData!.hp });
        }

        if (currentMana === null) {
            dispatch({ type: "SET_CURRENT_MANA", payload: partyMemberData!.mp });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        setTimeout(() => {
            setIsAttacking(false);
        }, 300)
    }, [isAttacking])

    useEffect(() => {
        setTimeout(() => {
            setIsDying(false);
        }, 1000)
    }, [isDying])

    if (!memberId) return;

    function epochToDate(epoch: number): Date {
        return new Date(epoch < 1e12 ? epoch * 1000 : epoch);
    }

    function convertAgeEpochToLevel(epoch: number) {
        const date = epochToDate(epoch);
        const now = new Date();

        let years = now.getFullYear() - date.getFullYear();

        const hasHadBirthday =
            now.getMonth() > date.getMonth() ||
            (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());

        if (!hasHadBirthday) years--;

        return years;
    }

    function getDaysUntilLevel(epoch: number) {
        const date = epochToDate(epoch);
        const now = new Date();

        const next = new Date(now.getFullYear(), date.getMonth(), date.getDate());

        if (next < now) {
            next.setFullYear(next.getFullYear() + 1);
        }

        const diff = next.getTime() - now.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    const handleOnClick = () => {
        if (!healthReduction) return;

        const damage = Math.floor(Math.random() * (35 - 15 + 1)) + 130;
        const multiplier = (Math.random() > 0.95) ? 2 : 1;


        if (!currentHealth) {
            playSound("error", isSoundEnabled);
            return;
        }

        setIsAttacking(true);
        setDamage(damage * multiplier);
        dispatch({ type: "SET_CURRENT_HEALTH", payload: Math.max(0, currentHealth - damage) });

        if (damage >= currentHealth) {
            playSound("delete", isSoundEnabled);
            setIsDying(true);
        }

        const sound = (damage * multiplier > 200) ? "crit" : "slash";
        playSound(sound, isSoundEnabled);
    }

    /**
     * Cross Slash. Empties the bar, then lands three hits — two ordinary and a
     * critical — each leaving its slash on screen until the whole cut spins away.
     */
    const runLimitBreak = () => {
        if (!healthReduction || limitRunningRef.current) return;

        if (!healthRef.current) {
            playSound("error", isSoundEnabled);
            return;
        }

        limitRunningRef.current = true;
        setLimitCharge(0);
        setLimitHits(0);
        setLimitSpinning(false);
        playSound("limit", isSoundEnabled);

        const after = (delay: number, run: () => void) => {
            limitTimersRef.current.push(window.setTimeout(run, delay));
        };

        const hit = (index: number, critical: boolean) => {
            const health = healthRef.current;
            // A dead party member ends the sequence early rather than hitting a corpse
            if (!health) return;

            const dealt = Math.floor(Math.random() * 21 + 130) * (critical ? 2 : 1);

            setIsAttacking(true);
            setDamage(dealt);
            setLimitHits(index + 1);
            dispatch({ type: "SET_CURRENT_HEALTH", payload: Math.max(0, health - dealt) });
            playSound(critical ? "crit" : "slash", isSoundEnabled);

            if (dealt >= health) {
                playSound("delete", isSoundEnabled);
                setIsDying(true);
            }
        };

        LIMIT_SLASHES.forEach((_, index) => {
            const critical = index === LIMIT_SLASHES.length - 1;
            after(LIMIT_TIMING.windUp + index * LIMIT_TIMING.betweenHits, () => hit(index, critical));
        });

        const lastHitAt = LIMIT_TIMING.windUp + (LIMIT_SLASHES.length - 1) * LIMIT_TIMING.betweenHits;
        after(lastHitAt + LIMIT_TIMING.beforeSpin, () => setLimitSpinning(true));
        after(lastHitAt + LIMIT_TIMING.beforeSpin + LIMIT_TIMING.spin, () => {
            setLimitHits(0);
            setLimitSpinning(false);
        });
        // Refilling last leaves the bar ready to go again
        after(lastHitAt + LIMIT_TIMING.beforeSpin + LIMIT_TIMING.spin + LIMIT_TIMING.beforeRefill, () => {
            setLimitCharge(100);
            limitRunningRef.current = false;
            limitTimersRef.current = [];
        });
    };

    const handleMouseEnter = () => {
        if (!healthReduction) return;
        landingNav.actions.focusTarget?.("avatar");
    }

    const handleEditName = () => {
        if (!healthReduction) return;
        playSound("select", isSoundEnabled);
        markKeyboardNavigation();
        navigate("/name");
    }

    const handleHealClick = () => {
        if (currentMana) {
            playSound("heal", isSoundEnabled);
            dispatch({ type: "SET_CURRENT_HEALTH", payload: partyMemberData!.hp });
            dispatch({ type: "SET_CURRENT_MANA", payload: Math.max(0, currentMana - 34) });
        } else {
            playSound("error", isSoundEnabled);
        }
    }

    attackRef.current = handleOnClick;
    reviveRef.current = handleHealClick;

    let content;

    if (partyMemberData) {
        const { name: memberName, hp, mp, limit_level, image_path, age_epoch } = partyMemberData;


        content = (
            <div className={`flex justify-between`}>
                <div className={styles.portrait} data-shake={isAttacking} data-dying={isDying} data-interactive={healthReduction} data-health={currentHealth?.toString()} data-focused={keyboardFocus === "avatar"}>
                    {isAttacking && <p className="absolute">{textToSprite(damage.toString(), true)}</p>}
                    <div className="self-center relative" onClick={handleOnClick} onMouseEnter={handleMouseEnter}>
                        <Portrait src={image_path} width={145} />
                        {limitHits > 0 && (
                            <div
                                className={styles.limitSlashes}
                                data-spinning={limitSpinning}
                                style={{
                                    width: `calc(${LIMIT_BOX.width} * var(--limit-unit))`,
                                    height: `calc(${LIMIT_BOX.height} * var(--limit-unit))`,
                                }}
                            >
                                {LIMIT_SLASHES.slice(0, limitHits).map(({ sheet, at }, index) => (
                                    <span
                                        key={index}
                                        className={styles.limitSlash}
                                        style={{
                                            // Everything is expressed in the sheet's own pixels and
                                            // scaled as one, so the slashes keep their alignment
                                            width: `calc(${sheet.width} * var(--limit-unit))`,
                                            height: `calc(${sheet.height} * var(--limit-unit))`,
                                            left: `calc(${at.x} * var(--limit-unit))`,
                                            top: `calc(${at.y} * var(--limit-unit))`,
                                            backgroundImage: `url(${LIMIT_SHEET})`,
                                            backgroundSize: `calc(${LIMIT_SHEET_SIZE.width} * var(--limit-unit)) calc(${LIMIT_SHEET_SIZE.height} * var(--limit-unit))`,
                                            backgroundPosition: `calc(${-sheet.x} * var(--limit-unit)) calc(${-sheet.y} * var(--limit-unit))`,
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                    {healthReduction && currentHealth === 0 && <div onClick={handleHealClick} onMouseEnter={() => landingNav.actions.focusTarget?.("revive")} className="absolute top-full"><ContentBox data-label="healButton" data-focused={keyboardFocus === "revive"}>{textToSprite("Revive", false, (!currentMana || currentMana < 34) ? "grey" : "")}</ContentBox></div>}
                </div>
                <div className="mt-2 ml-8">
                    {healthReduction ? (
                        <div className={`${styles.username} mb-2 flex items-center`} onClick={handleEditName}>
                            {textToSprite(userName || memberName)}
                            <span className="font-glyph ml-2" data-sprite="edit-icon"></span>
                        </div>
                    ) : (
                        <p className="mb-2">{textToSprite(userName || memberName)}</p>
                    )}
                    <p className="flex">
                        <span className="font-glyph" data-sprite="lv">lv</span>
                        {textToSprite(convertAgeEpochToLevel(new Date(age_epoch).getTime()).toFixed(0), true)}
                    </p>
                    <ResourceCounter label="hp" maxValue={hp} currentValue={currentHealth || 0} accentColor="#4f8fd4" />
                    <ResourceCounter label="mp" maxValue={mp} currentValue={currentMana || 0} accentColor="#63d9c1" />
                </div>
                {showProgressBars && (
                    <div className="mt-12">
                        <p>{textToSprite("next level")}</p>
                        <div className="ml-7">
                            <ProgressBar percentage={100 - (getDaysUntilLevel(age_epoch) / 365) * 100} />
                        </div>
                        <p>{textToSprite(`Limit level ${limit_level.toString()}`)}</p>
                        <div
                            className={`ml-7 ${healthReduction ? styles.limitBar : ""}`}
                            onClick={runLimitBreak}
                            data-ready={healthReduction && limitCharge === 100}
                        >
                            <ProgressBar percentage={limitCharge} accentColor="#dfbddd" data-limit="true" />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return content;
}

export default PartyMember;