import textToSprite from "../../util/textToSprite.tsx";

import ProgressBar from "../ProgressBar/ProgressBar.tsx";
import ResourceCounter from "../ResourceCounter/ResourceCounter.tsx";
import partyMemberJSON from "../../data/partyMember.json";
import type { PartyMemberType } from "../../context/types.tsx";
import { useState, useEffect } from "react";
import playSound from "../../util/sounds.ts";
import { useContext } from "../../context/context.tsx";
import styles from "./PartyMember.module.scss";

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
    const { isSoundEnabled, currentHealth, dispatch } = useContext();

    useEffect(() => {
        if (currentHealth === null) {
            dispatch({ type: "SET_CURRENT_HEALTH", payload: partyMemberData!.hp });
        }
    }, [])

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
        if (healthReduction && currentHealth) {
            setIsAttacking(true);
            const healthReduction = Math.floor(Math.random() * (35 - 15 + 1)) + 20;
            const multiplier = (Math.random() > 0.95) ? 2 : 1;
            setDamage(healthReduction * multiplier);
            dispatch({ type: "SET_CURRENT_HEALTH", payload: Math.max(0, currentHealth - healthReduction) });

            if (healthReduction >= currentHealth) {
                playSound("delete", isSoundEnabled);
                setIsDying(true);
            } else {
                if (healthReduction * multiplier > 50) {
                    playSound("crit", isSoundEnabled);
                } else {
                    playSound("slash", isSoundEnabled);
                }
            }
        } else {
            if (!healthReduction) return;
            playSound("error", isSoundEnabled);
        }
    }

    const handleMouseEnter = () => {
        if (!healthReduction) return;
        playSound("select", isSoundEnabled)
    }

    let content;

    if (partyMemberData) {
        const { name: memberName, hp, mp, limit_level, image_path, age_epoch } = partyMemberData;


        content = (
            <div className={`flex justify-between`}>
                <div className={styles.portrait} data-shake={isAttacking} data-dying={isDying} data-interactive={healthReduction}>
                    {isAttacking && <p className="absolute">{textToSprite(damage.toString(), true)}</p>}
                    <img src={image_path} alt="Party Member Portrait" width={145} className="object-contain" onClick={handleOnClick} onMouseEnter={handleMouseEnter} />
                </div>
                <div className="mt-2 ml-8">
                    <p className="mb-2">{textToSprite(memberName)}</p>
                    <p className="flex">
                        <span className="font-glyph" data-sprite="lv">lv</span>
                        {textToSprite(convertAgeEpochToLevel(new Date(age_epoch).getTime()).toFixed(0), true)}
                    </p>
                    <ResourceCounter label="hp" maxValue={hp} currentValue={currentHealth || 0} accentColor="#4f8fd4" />
                    <ResourceCounter label="mp" maxValue={mp} currentValue={mp} accentColor="#63d9c1" />
                </div>
                {showProgressBars && (
                    <div className="mt-12">
                        <p>{textToSprite("next level")}</p>
                        <div className="ml-7">
                            <ProgressBar percentage={100 - (getDaysUntilLevel(age_epoch) / 365) * 100} />
                        </div>
                        <p>{textToSprite(`Limit level ${limit_level.toString()}`)}</p>
                        <div className="ml-7">
                            <ProgressBar percentage={100} accentColor="#dfbddd" data-limit="true" />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return content;
}

export default PartyMember;