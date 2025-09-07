import json
import re
import requests
from urllib.parse import urlparse
from typing import Dict, List, Tuple, Any
from dataclasses import dataclass
from collections import defaultdict

@dataclass
class EvalResult:
    """Stores evaluation results for a single extraction"""
    url_valid: bool
    json_parseable: bool
    required_fields_present: bool
    field_quality_scores: Dict[str, float]
    overall_score: float
    issues: List[str]

class ProductExtractionEvaluator:
    """Evaluates LLM product extraction quality"""

    def __init__(self):
        self.required_fields = ["image_url", "type", "description", "product_link"]
        self.optional_fields = ["model_no", "qty", "key"]

    def evaluate_extraction(self, json_str: str, source_url: str = None) -> EvalResult:
        """
        Evaluate a single product extraction

        Args:
            json_str: The JSON string from LLM
            source_url: Original URL that was scraped (optional)

        Returns:
            EvalResult with detailed scoring
        """
        issues = []
        field_scores = {}

        # 1. JSON Parseability Test
        try:
            data = json.loads(json_str)
            json_parseable = True
        except json.JSONDecodeError as e:
            return EvalResult(
                url_valid=False,
                json_parseable=False,
                required_fields_present=False,
                field_quality_scores={},
                overall_score=0.0,
                issues=[f"JSON parsing failed: {e}"]
            )

        # 2. Required Fields Test
        missing_fields = [f for f in self.required_fields if f not in data]
        required_fields_present = len(missing_fields) == 0
        if missing_fields:
            issues.append(f"Missing required fields: {missing_fields}")

        # 3. Field Quality Evaluation
        field_scores["image_url"] = self._evaluate_url(data.get("image_url", ""))
        field_scores["product_link"] = self._evaluate_url(data.get("product_link", ""))
        field_scores["type"] = self._evaluate_type_field(data.get("type", ""))
        field_scores["description"] = self._evaluate_description(data.get("description", ""))
        field_scores["model_no"] = self._evaluate_model_no(data.get("model_no", ""))
        field_scores["qty"] = self._evaluate_quantity(data.get("qty", ""))

        # 4. URL Validation
        urls_valid = all([
            self._is_valid_url(data.get("image_url", "")),
            self._is_valid_url(data.get("product_link", ""))
        ])

        # 5. Content Consistency Checks
        consistency_score = self._check_consistency(data, source_url)
        field_scores["consistency"] = consistency_score

        # 6. Calculate Overall Score
        overall_score = self._calculate_overall_score(field_scores, required_fields_present, urls_valid)

        return EvalResult(
            url_valid=urls_valid,
            json_parseable=json_parseable,
            required_fields_present=required_fields_present,
            field_quality_scores=field_scores,
            overall_score=overall_score,
            issues=issues
        )

    def _evaluate_url(self, url: str) -> float:
        """Score URL quality (0-1)"""
        if not url or url.strip() == "":
            return 0.0

        if not self._is_valid_url(url):
            return 0.2

        # Check if it's a reasonable image/product URL
        if any(ext in url.lower() for ext in ['.jpg', '.png', '.jpeg', '.webp', '.gif']):
            return 1.0
        elif 'image' in url.lower() or 'photo' in url.lower() or 'product' in url.lower():
            return 0.8
        else:
            return 0.6

    def _is_valid_url(self, url: str) -> bool:
        """Check if URL is properly formatted"""
        try:
            result = urlparse(url)
            return all([result.scheme, result.netloc])
        except Exception:
            return False

    def _evaluate_type_field(self, type_val: str) -> float:
        """Score product type quality"""
        if not type_val or type_val.strip() == "":
            return 0.0

        # Check for reasonable product categories
        common_types = [
            'furniture', 'electronics', 'clothing', 'kitchen', 'outdoor',
            'fireplace', 'appliance', 'tool', 'decoration', 'lighting'
        ]

        type_lower = type_val.lower()
        if any(cat in type_lower for cat in common_types):
            return 1.0
        elif len(type_val.strip()) > 2:
            return 0.7
        else:
            return 0.3

    def _evaluate_description(self, desc: str) -> float:
        """Score description quality"""
        if not desc or desc.strip() == "":
            return 0.0

        desc_clean = desc.strip()

        # Length check
        if len(desc_clean) < 10:
            return 0.3
        elif len(desc_clean) < 50:
            return 0.6
        elif len(desc_clean) > 500:
            return 0.8  # Might be too verbose
        else:
            return 1.0

    def _evaluate_model_no(self, model: str) -> float:
        """Score model number field"""
        if not model or model.strip() == "":
            return 0.5  # Neutral - not always available

        # Look for typical model patterns
        if re.search(r'[A-Z]{2,}[-\s]?\d+', model):
            return 1.0
        elif len(model.strip()) > 2:
            return 0.7
        else:
            return 0.3

    def _evaluate_quantity(self, qty: str) -> float:
        """Score quantity field"""
        if not qty or qty.strip() == "":
            return 0.5

        qty_lower = qty.lower().strip()
        if any(word in qty_lower for word in ['unspecified', 'unknown', 'n/a']):
            return 0.8  # Honest about not knowing
        elif re.search(r'\d+', qty):
            return 1.0
        else:
            return 0.6

    def _check_consistency(self, data: Dict, source_url: str = None) -> float:
        """Check internal consistency of extracted data"""
        score = 1.0

        # Check if product_link and image_url are from same domain
        try:
            if data.get("product_link") and data.get("image_url"):
                prod_domain = urlparse(data["product_link"]).netloc
                img_domain = urlparse(data["image_url"]).netloc

                if prod_domain and img_domain:
                    # Same domain is good
                    if prod_domain == img_domain:
                        score += 0.1
                    # Different but reasonable domains
                    elif any(common in prod_domain for common in img_domain.split('.')):
                        score += 0.05
        except Exception:
            score -= 0.1

        return min(score, 1.0)

    def _calculate_overall_score(self, field_scores: Dict[str, float],
                               required_present: bool, urls_valid: bool) -> float:
        """Calculate weighted overall score"""
        if not required_present:
            return 0.2

        # Weighted scoring
        weights = {
            "image_url": 0.2,
            "product_link": 0.2,
            "type": 0.15,
            "description": 0.25,
            "model_no": 0.05,
            "qty": 0.05,
            "consistency": 0.1
        }

        weighted_score = sum(field_scores.get(field, 0) * weight
                           for field, weight in weights.items())

        # Penalty for invalid URLs
        if not urls_valid:
            weighted_score *= 0.7

        return round(weighted_score, 3)

    def evaluate_batch(self, extractions: List[Tuple[str, str]]) -> Dict[str, Any]:
        """
        Evaluate multiple extractions and return summary statistics

        Args:
            extractions: List of (json_string, source_url) tuples

        Returns:
            Dictionary with batch evaluation results
        """
        results = []
        for json_str, source_url in extractions:
            result = self.evaluate_extraction(json_str, source_url)
            results.append(result)

        # Calculate batch statistics
        scores = [r.overall_score for r in results]
        field_scores = defaultdict(list)

        for result in results:
            for field, score in result.field_quality_scores.items():
                field_scores[field].append(score)

        # Aggregate statistics
        batch_stats = {
            "total_extractions": len(results),
            "avg_score": sum(scores) / len(scores) if scores else 0,
            "min_score": min(scores) if scores else 0,
            "max_score": max(scores) if scores else 0,
            "json_parse_success_rate": sum(1 for r in results if r.json_parseable) / len(results),
            "required_fields_success_rate": sum(1 for r in results if r.required_fields_present) / len(results),
            "url_validity_rate": sum(1 for r in results if r.url_valid) / len(results),
            "field_avg_scores": {
                field: sum(scores) / len(scores) if scores else 0
                for field, scores in field_scores.items()
            },
            "low_quality_extractions": [
                i for i, result in enumerate(results) if result.overall_score < 0.6
            ],
            "common_issues": self._get_common_issues(results)
        }

        print("=== BATCH EVALUATION RESULTS ===")
        print(f"Total extractions: {batch_stats['total_extractions']}")
        print(f"Average score: {batch_stats['avg_score']:.3f}")
        print(f"JSON parse success rate: {batch_stats['json_parse_success_rate']:.2%}")
        print(f"Required fields success rate: {batch_stats['required_fields_success_rate']:.2%}")
        print(f"URL validity rate: {batch_stats['url_validity_rate']:.2%}")
        print("\nField Average Scores:")
        for field, score in batch_stats['field_avg_scores'].items():
            print(f"  {field}: {score:.3f}")

        if batch_stats['low_quality_extractions']:
            print(f"\nLow quality extractions (indices): {batch_stats['low_quality_extractions']}")

        if batch_stats['common_issues']:
            print("\nCommon issues:")
            for issue, count in batch_stats['common_issues'].items():
                print(f"  {issue}: {count} occurrences")

        return batch_stats

    def _get_common_issues(self, results: List[EvalResult]) -> Dict[str, int]:
        """Find most common issues across extractions"""
        issue_counts = defaultdict(int)
        for result in results:
            for issue in result.issues:
                issue_counts[issue] += 1
        return dict(sorted(issue_counts.items(), key=lambda x: x[1], reverse=True))
