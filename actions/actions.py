import typing
from typing import Any, Dict, List, Text

from rasa_sdk import Action, Tracker
from rasa_sdk.events import SlotSet
from rasa_sdk.executor import CollectingDispatcher

if typing.TYPE_CHECKING:  # pragma: no cover
    from rasa_sdk.executor import CollectingDispatcher
    from rasa_sdk.types import DomainDict, TrackerState

# class ActionCheckSufficientFunds(Action):
#     def name(self) -> Text:
#         return "action_check_sufficient_funds"

#     def run(
#         self,
#         dispatcher: CollectingDispatcher,
#         tracker: Tracker,
#         domain: Dict[Text, Any],
#     ) -> List[Dict[Text, Any]]:
#         # hard-coded balance for tutorial purposes. in production this
#         # would be retrieved from a database or an API
#         balance = 1000
#         transfer_amount = tracker.get_slot("amount")
#         has_sufficient_funds = transfer_amount <= balance
#         return [SlotSet("has_sufficient_funds", has_sufficient_funds)]


class ActionRecommendStudyNextStep(Action):
    def name(self) -> Text:
        return "action_recommend_study_next_step"

    async def run(
        self,
        dispatcher: "CollectingDispatcher",
        tracker: Tracker,
        domain: "DomainDict",
    ) -> List[Dict[Text, Any]]:
        study_event = tracker.get_slot("study_event")
        study_deadline = tracker.get_slot("study_deadline")
        study_preparation = tracker.get_slot("study_preparation")
        study_difficulties = tracker.get_slot("study_difficulties")

        # Normalise slot values for simple rule-based checks.
        deadline = str(study_deadline or "").lower()
        preparation = str(study_preparation or "").lower()
        difficulties = str(study_difficulties or "").strip()

        # Urgent: the exam or deadline is very soon.
        urgent_terms = (
            "in an hour",
            "in one hour",
            "in 30 minutes",
            "in half an hour",
            "in 15 minutes",
            "in 10 minutes",
            "right now",
            "starting soon",
            "starts soon",
            "today",
        )

        if any(term in deadline for term in urgent_terms):
            advice = (
                f"Since {study_event or 'your study task'} is coming up soon, "
                "focus on the most important material rather than trying to "
                "cover everything. Spend a few minutes reviewing the key "
                "concepts or formulas you are least confident about. Avoid "
                "starting a large new topic at the last minute."
            )

        # Little or no preparation reported.
        elif any(
            term in preparation
            for term in (
                "haven't started",
                "have not started",
                "nothing yet",
                "not started",
                "haven't studied",
                "have not studied",
            )
        ):
            advice = (
                f"Start with one small, concrete step for "
                f"{study_event or 'your study task'}. Identify the most "
                "important topic or requirement, then spend 20 minutes "
                "working on it without distractions. You do not need to "
                "solve everything at once."
            )

        # A specific difficulty has been identified.
        elif difficulties:
            advice = (
                f"Since you're struggling with {difficulties}, start by "
                "breaking it into a smaller question or subtask. Work through "
                "one example, explain the concept in your own words, or note "
                "exactly which step you do not understand. Focus on that "
                "specific gap before moving on."
            )

        # General fallback.
        else:
            advice = (
                f"For {study_event or 'your study task'}, choose the single "
                "most important thing you can make progress on next. Work on "
                "it for 20 minutes, then check what you have completed and "
                "decide on the next step."
            )

        dispatcher.utter_message(text=advice)
        return []
