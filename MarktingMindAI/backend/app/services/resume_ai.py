from __future__ import annotations

import json
import os
import re
from io import BytesIO
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, UploadFile

COMMON_SKILLS = {
    "python",
    "java",
    "fastapi",
    "spring",
    "sql",
    "postgresql",
    "aws",
    "azure",
    "docker",
    "kubernetes",
    "llm",
    "langchain",
    "machine learning",
    "mlops",
    "pandas",
    "numpy",
    "react",
    "typescript",
    "node",
    "rest",
}

EMAIL_REGEX = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_REGEX = re.compile(r"(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}")
EXPERIENCE_REGEX = re.compile(r"(\d+(?:\.\d+)?)\+?\s+years?", re.IGNORECASE)


async def parse_resume_with_ai(
    file: UploadFile,
    target_role: str,
    required_skills: List[str],
) -> Dict[str, Any]:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded resume file is empty.")

    text = _extract_text(file.filename or "resume.txt", content)
    cleaned_text = _normalize_text(text)

    parsed_profile = _rule_based_profile_parse(cleaned_text)
    ml_assessment = _ml_skill_assessment(cleaned_text, target_role, required_skills)
    llm_assessment, agent_trace = _langchain_agent_assessment(cleaned_text, target_role, required_skills)

    preview = cleaned_text[:400]

    return {
        "filename": file.filename or "resume.txt",
        "contentType": file.content_type or "application/octet-stream",
        "sizeBytes": len(content),
        "extractedTextPreview": preview,
        "parsedProfile": parsed_profile,
        "mlAssessment": ml_assessment,
        "llmAssessment": llm_assessment,
        "agentTrace": agent_trace,
    }


def _extract_text(filename: str, content: bytes) -> str:
    lowered = filename.lower()

    if lowered.endswith(".txt"):
        return content.decode("utf-8", errors="ignore")

    if lowered.endswith(".pdf"):
        try:
            from pypdf import PdfReader

            reader = PdfReader(BytesIO(content))
            return "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception:
            return content.decode("utf-8", errors="ignore")

    if lowered.endswith(".docx"):
        try:
            from docx import Document

            doc = Document(BytesIO(content))
            return "\n".join(paragraph.text for paragraph in doc.paragraphs)
        except Exception:
            return content.decode("utf-8", errors="ignore")

    return content.decode("utf-8", errors="ignore")


def _normalize_text(text: str) -> str:
    compact = re.sub(r"\r", "\n", text)
    compact = re.sub(r"\n{3,}", "\n\n", compact)
    return compact.strip()


def _rule_based_profile_parse(text: str) -> Dict[str, Any]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    full_name = lines[0] if lines else None

    email_match = EMAIL_REGEX.search(text)
    phone_match = PHONE_REGEX.search(text)

    location = None
    for line in lines[:10]:
        if "," in line and any(ch.isdigit() for ch in line) is False and len(line) <= 80:
            location = line
            break

    extracted_skills = sorted({skill for skill in COMMON_SKILLS if skill in text.lower()})

    years_experience = None
    exp_match = EXPERIENCE_REGEX.search(text)
    if exp_match:
        try:
            years_experience = float(exp_match.group(1))
        except ValueError:
            years_experience = None

    summary = " ".join(lines[:3])[:350]

    return {
        "fullName": full_name,
        "email": email_match.group(0) if email_match else None,
        "phone": phone_match.group(0) if phone_match else None,
        "location": location,
        "skills": extracted_skills,
        "yearsExperience": years_experience,
        "summary": summary,
    }


def _ml_skill_assessment(text: str, target_role: str, required_skills: List[str]) -> Dict[str, Any]:
    normalized_required = [skill.strip().lower() for skill in required_skills if skill.strip()]
    normalized_required = list(dict.fromkeys(normalized_required))

    if not normalized_required:
        normalized_required = ["python", "sql", "communication"]

    matched = [skill for skill in normalized_required if skill in text.lower()]
    missing = [skill for skill in normalized_required if skill not in matched]

    model_type = "keyword_overlap"
    score = round((len(matched) / len(normalized_required)) * 100)

    # Optional lightweight ML scoring when sklearn is available.
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity

        target_profile = f"{target_role} {' '.join(normalized_required)}"
        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        matrix = vectorizer.fit_transform([text, target_profile])
        similarity = float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0])
        score = max(score, round(similarity * 100))
        model_type = "sklearn_tfidf_cosine"
    except Exception:
        pass

    return {
        "modelType": model_type,
        "targetRole": target_role,
        "matchScore": max(0, min(100, score)),
        "matchedSkills": matched,
        "missingSkills": missing,
    }


def _langchain_agent_assessment(text: str, target_role: str, required_skills: List[str]) -> tuple[Dict[str, Any], Dict[str, Any]]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return (
            {
                "usedLangChain": False,
                "provider": "none",
                "model": "none",
                "status": "fallback",
                "insights": "LLM step skipped because OPENAI_API_KEY is not configured.",
            },
            {
                "used": False,
                "mode": "fallback",
                "steps": [
                    "extract_text",
                    "rule_based_profile_parse",
                    "ml_skill_assessment",
                ],
            },
        )

    try:
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_openai import ChatOpenAI

        model_name = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        llm = ChatOpenAI(model=model_name, temperature=0)

        system_prompt = (
            "You are a resume analysis assistant. Return valid JSON with keys: "
            "insights, strengths, improvements. Keep each concise."
        )
        user_prompt = (
            "Target role: {target_role}\n"
            "Required skills: {required_skills}\n"
            "Resume:\n{text}\n"
        )

        prompt = ChatPromptTemplate.from_messages(
            [
                ("system", system_prompt),
                ("human", user_prompt),
            ]
        )

        chain = prompt | llm
        response = chain.invoke(
            {
                "target_role": target_role,
                "required_skills": ", ".join(required_skills),
                "text": text[:12000],
            }
        )

        raw_content = response.content if hasattr(response, "content") else str(response)
        parsed = _safe_parse_json(raw_content)

        if parsed:
            insights = parsed.get("insights") or "Structured analysis generated by LangChain."
            strengths = parsed.get("strengths") or []
            improvements = parsed.get("improvements") or []
            insight_block = (
                f"Insights: {insights}\n"
                f"Strengths: {', '.join(strengths) if isinstance(strengths, list) else strengths}\n"
                f"Improvements: {', '.join(improvements) if isinstance(improvements, list) else improvements}"
            )
        else:
            insight_block = raw_content[:1200]

        return (
            {
                "usedLangChain": True,
                "provider": "openai",
                "model": model_name,
                "status": "ok",
                "insights": insight_block,
            },
            {
                "used": True,
                "mode": "langchain_chain",
                "steps": [
                    "extract_text",
                    "rule_based_profile_parse",
                    "ml_skill_assessment",
                    "langchain_prompt_build",
                    "langchain_llm_invoke",
                    "agent_summary_finalize",
                ],
            },
        )
    except Exception as exc:
        return (
            {
                "usedLangChain": False,
                "provider": "openai",
                "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                "status": "error",
                "insights": f"LangChain invocation failed: {str(exc)}",
            },
            {
                "used": False,
                "mode": "fallback_after_error",
                "steps": [
                    "extract_text",
                    "rule_based_profile_parse",
                    "ml_skill_assessment",
                    "langchain_error_fallback",
                ],
            },
        )


def _safe_parse_json(value: str) -> Optional[Dict[str, Any]]:
    cleaned = value.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json\n", "", 1)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
        return None
    except Exception:
        return None
