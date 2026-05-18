"""
Context-aware causes / precautions / cultural-care guidance derived from model outputs.

No LLM: rule + pathology-category templates keyed off plant, disease label, confidence,
and severity bars (affected / slight / healthy fractions). Keeps FYP content tied to each prediction.
"""

from __future__ import annotations

from typing import Any


def _confidence_band(conf_pct: float) -> str:
    if conf_pct >= 82.0:
        return "high"
    if conf_pct >= 62.0:
        return "moderate"
    return "low"


def _severity_tone(affected_pct: float, slightly_pct: float, is_healthy: bool) -> str:
    if is_healthy:
        return "healthy_signal"
    if affected_pct >= 58.0:
        return "strong_stress"
    if affected_pct >= 35.0 or slightly_pct >= 45.0:
        return "moderate_stress"
    return "early_or_uncertain"


def _infer_category(raw_label: str, disease: str, plant: str) -> str:
    blob = f"{raw_label} {disease} {plant}".lower().replace("(including_sour)", "")
    if "healthy" in disease.lower() or "___healthy" in blob or blob.strip().endswith("healthy"):
        return "healthy"
    if "huanglongbing" in blob or "greening" in blob or "citrus_greening" in blob:
        return "citrus_greening"
    if "blast" in blob:
        return "blast"
    if "rust" in blob:
        return "rust"
    if "bacterial" in blob or "bacterial blight" in blob:
        return "bacterial"
    if "powdery" in blob or "downy" in blob or "mildew" in blob:
        return "mildew"
    if "mosaic" in blob or "virus" in blob or "curl" in blob:
        return "viral"
    if "mite" in blob or "spider" in blob:
        return "mite"
    if "blight" in blob:
        return "blight"
    if "rot" in blob or "scab" in blob or "esca" in blob or "measles" in blob:
        return "rot_complex"
    if (
        "spot" in blob
        or "leaf mold" in blob
        or "septoria" in blob
        or "cercospora" in blob
        or "gray leaf" in blob
        or "target spot" in blob
        or "leaf blight" in blob
    ):
        return "fungal_leaf_spot"
    return "general"


def _plant_sentence(plant: str) -> str:
    p = (plant or "this crop").strip()
    return p if p else "this crop"


def enrich_prediction_context(
    *,
    plant: str,
    disease: str,
    raw_label: str,
    conf_pct: float,
    affected_pct: float,
    slightly_pct: float,
    not_affected_pct: float,
    sector_id: str,
    is_healthy: bool,
) -> dict[str, Any]:
    pb = _plant_sentence(plant)
    cat = _infer_category(raw_label or "", disease or "", plant or "")
    band = _confidence_band(conf_pct)
    sev = _severity_tone(affected_pct, slightly_pct, is_healthy)

    causes: list[str] = []
    prevention: list[str] = []
    treatment: list[str] = []
    suffix_parts: list[str] = []

    staple = sector_id == "field_core"

    # ---------- Healthy leaf ----------
    if is_healthy or cat == "healthy":
        causes.append(
            f"The classifier matched the trained healthy appearance for {pb}. "
            f"No labeled disease class scored higher than healthy with your image conditions."
        )
        if band == "high":
            causes.append(
                "Strong confidence usually means texture and color cues aligned with healthy leaves in the training set."
            )
            suffix_parts.append(
                "Confidence is high — keep routine scouting so early symptoms are not missed later."
            )
        elif band == "moderate":
            causes.append(
                "Moderate confidence can occur with glare, motion blur, shadows, or very young leaves that resemble other classes."
            )
            suffix_parts.append(
                "Consider a sharper image if symptoms exist on other leaves."
            )
        else:
            causes.append(
                "Low confidence suggests ambiguity — lighting or framing may hide lesions at edges."
            )
            suffix_parts.append(
                "If neighboring leaves show spots or discoloration, rescan those leaves."
            )

        prevention.extend(
            [
                f"Rotate plant inspection across {pb} weekly during humid or rainy periods.",
                "Water at the base where possible to keep foliage dry overnight.",
                "Remove debris under plants and prune overcrowded canopy for airflow.",
                "Sanitize pruning tools between plants when symptoms appear elsewhere.",
                "Record GPS/plot notes so recurring hotspots can be traced next season.",
            ]
        )
        if staple:
            prevention.insert(
                2,
                "For field plots: vary planting dates within recommendations to spread disease pressure.",
            )
        else:
            prevention.insert(
                2,
                "For garden blocks: avoid overhead irrigation during prolonged leaf-wet hours.",
            )

        treatment.append(
            "No disease-specific chemical action is indicated from this prediction — focus on prevention and monitoring."
        )
        return {
            "causes": causes[:6],
            "prevention_tips": prevention[:8],
            "treatment": treatment[:5],
            "description_suffix": (" " + " ".join(suffix_parts)).strip(),
        }

    # ---------- Diseased paths ----------
    def pack_templates(cause_lines: list[str], prev_lines: list[str], treat_lines: list[str]) -> None:
        causes.extend([c.format(pb=pb, dis=disease) for c in cause_lines])
        prevention.extend([p.format(pb=pb, dis=disease) for p in prev_lines])
        treatment.extend([t.format(pb=pb, dis=disease) for t in treat_lines])

    templates: dict[str, tuple[list[str], list[str], list[str]]] = {
        "blight": (
            [
                "Many blights spread fastest when leaves stay wet for many hours (rain, dew, or irrigation).",
                "Spores can splash from soil onto lower leaves and climb the canopy.",
                "Stress from nutrient imbalance or compaction can make {pb} tissues more susceptible.",
            ],
            [
                "Increase row spacing or prune inner shoots so leaves dry quickly after rain.",
                "Avoid working in wet canopy; inspect lower leaves first — infections often start there.",
                "Remove visibly infected leaves into sealed bags if intensity is low and permitted locally.",
                "Plan resistant varieties for {pb} where regional recommendations exist.",
            ],
            [
                "Isolate pockets that worsen between scans and photograph progression for an agronomist.",
                "Improve drainage around root zones and reduce leaf wetness duration.",
            ],
        ),
        "fungal_leaf_spot": (
            [
                "Spot diseases favor humid microclimates with poor airflow.",
                "Old infected litter under plants reinfects new foliage via splash dispersal.",
                "Nutrient stress sometimes exaggerates necrotic-looking lesions.",
            ],
            [
                "Mulch to reduce soil splash onto lower foliage.",
                "Time irrigation so foliage dries before evening cooling.",
                "Thin canopy selectively on {pb} if branches overlap excessively.",
            ],
            [
                "Mark heavily spotted zones for targeted scouting within 3–5 days.",
                "Clean fallen debris under affected plants after pruning.",
            ],
        ),
        "rust": (
            [
                "Rust fungi produce airborne spores and often cycle alternate hosts nearby.",
                "Cool nights plus mild days accelerate infection cycles on susceptible {pb}.",
            ],
            [
                "Eliminate known alternate-host weeds adjacent to the plot.",
                "Ensure fertilizer program avoids nitrogen excess that drives lush susceptible growth.",
                "Harvest promptly when maturity allows — aging foliage rusts more.",
            ],
            [
                "Flag earliest infected leaves to gauge spread direction across rows.",
            ],
        ),
        "mildew": (
            [
                "Powdery mildew thrives on humid pockets even without continuous leaf wetness.",
                "Dense foliage traps stagnant air under cloudy stretches.",
            ],
            [
                "Open canopy on {pb} early enough that midday sun reaches inner leaves.",
                "Avoid excessive nitrogen that produces soft, mildew-prone tissue.",
            ],
            [
                "Remove the worst-coated shoots first when infestation is localized.",
            ],
        ),
        "bacterial": (
            [
                "Bacterial pathogens often enter via wounds, hail scars, or insect feeding marks.",
                "Splash from contaminated soil can move bacteria to leaf stomata.",
            ],
            [
                "Avoid pruning during wet weather for {pb}.",
                "Disinfect tools between plants if lesions look angular/water-soaked.",
                "Reduce overhead irrigation where bacterial diseases historically recur.",
            ],
            [
                "Separate plants showing systemic wilt from asymptomatic neighbors pending diagnosis.",
            ],
        ),
        "viral": (
            [
                "Plant viruses spread mechanically on tools and often persist in infected planting stock.",
                "Sap-feeding vectors (whiteflies, aphids) bridge infected weeds into healthy {pb}.",
            ],
            [
                "Control nearby weeds that harbor viruses or vectors.",
                "Inspect seedlings before transplant — discard mosaic-looking outliers.",
                "Avoid touching plants after smoking/handling infected tobacco relatives.",
            ],
            [
                "Sample suspect tissue through extension labs where virus confirmation matters economically.",
            ],
        ),
        "blast": (
            [
                "Blast fungi attack tender tissues during prolonged dew periods.",
                "High nitrogen and dense stands intensify blast epidemics in cereals.",
            ],
            [
                "Avoid excessive nitrogen topdress aligned with blast-risk forecasts.",
                "Maintain moderate flood timing where irrigation interacts with blast.",
                "Use blast-resistant cultivars when cultivar swap is feasible.",
            ],
            [
                "Drain excess standing water from nursery trays/beds promptly.",
            ],
        ),
        "rot_complex": (
            [
                "Rot diseases exploit wounds, sunburned fruit, or aging tissue.",
                "Spores incubate in humid storage piles after harvest.",
            ],
            [
                "Harvest {pb} during dry windows with gentle handling to reduce bruising.",
                "Improve orchard/vine airflow after pruning cuts heal.",
            ],
            [
                "Cull visibly rotten fruit/lateral stems before storing.",
            ],
        ),
        "citrus_greening": (
            [
                "Huanglongbing is vectored by Asian citrus psyllid — infected trees decline without obvious fungal sporulation.",
                "Symptoms can mimic nutrient deficiencies; leaf pattern matters.",
            ],
            [
                "Coordinate area-wide psyllid monitoring where mandatory.",
                "Replace severely declining trees only under regulatory guidance.",
            ],
            [
                "Never move uncertified budwood between regions.",
            ],
        ),
        "mite": (
            [
                "Spider mites explode under hot, dusty conditions with predatory-arthropod disruption.",
            ],
            [
                "Wash dusty foliage gently before scouting — dust favors mites.",
                "Preserve flowering strips that support beneficial predators.",
            ],
            [
                "Focus sprays (if used) on underside of leaves where mites cluster.",
            ],
        ),
        "general": (
            [
                "Stress combinations — drought then rewetting, compaction, or shade — predispose {pb} to secondary pathogens.",
                "Lesion shape on only part of the leaf often differs from mineral deficiencies affecting whole leaves uniformly.",
            ],
            [
                "Improve drainage and organic matter gradually around roots.",
                "Photograph multiple angles next scan under diffuse daylight.",
            ],
            [
                "Consult local extension with labeled GPS plot info when economics justify lab confirmation.",
            ],
        ),
    }

    key = cat if cat in templates else "general"
    pack_templates(*templates[key])

    # Severity / confidence tuning — concise, not repetitive
    if sev == "strong_stress" and band == "high":
        prevention.insert(
            0,
            f"Model assigns notable severity toward «{disease}» on {pb} — escalate scouting within days.",
        )
    elif sev == "moderate_stress":
        prevention.insert(
            0,
            "Intermediate severity spread suggests mixed signals — verify against neighboring leaves.",
        )
    elif sev == "early_or_uncertain":
        prevention.insert(
            0,
            "Early-stage signatures may resemble nutrient burn — confirm with soil/plant tissue tests if unsure.",
        )

    if band == "low":
        suffix_parts.append(
            "Classifier confidence is modest — treat guidance as preliminary until symptoms clarify."
        )
    elif band == "moderate":
        suffix_parts.append(
            "Confidence is moderate — capture additional leaf images if management decisions are high-stakes."
        )

    # Tie severity bars subtly into narrative without contradicting chart math
    if slightly_pct > affected_pct + 10 and not is_healthy:
        causes.append(
            "Severity bars skew slightly affected vs heavily damaged — watch if lesions enlarge within a week."
        )

    return {
        "causes": causes[:8],
        "prevention_tips": prevention[:10],
        "treatment": treatment[:6],
        "description_suffix": (" " + " ".join(suffix_parts)).strip(),
    }
