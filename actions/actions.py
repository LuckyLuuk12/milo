import re
import typing
from typing import Any, Dict, Iterable, List, Text

from rasa_sdk import Action, Tracker
from rasa_sdk.events import SlotSet
from rasa_sdk.executor import CollectingDispatcher

if typing.TYPE_CHECKING:  # pragma: no cover
    from rasa_sdk.executor import CollectingDispatcher
    from rasa_sdk.types import DomainDict, TrackerState


def mentions_any(text: Text, terms: Iterable[Text]) -> bool:
    """Return True if the text contains one of the terms as whole words.

    A plain substring check also matches inside other words, for example
    "now" in "I don't know" or "plan" in "explanation".
    """
    # Phone keyboards often type a curly apostrophe ("haven’t").
    text = text.lower().replace("’", "'")

    return any(
        re.search(rf"\b{re.escape(term)}\b", text) for term in terms
    )

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

        if mentions_any(deadline, urgent_terms):
            advice = (
                f"Since {study_event or 'your study task'} is coming up soon, "
                "focus on the most important material rather than trying to "
                "cover everything. Spend a few minutes reviewing the key "
                "concepts or formulas you are least confident about. Avoid "
                "starting a large new topic at the last minute."
            )

        # Little or no preparation reported.
        elif mentions_any(
            preparation,
            (
                "haven't started",
                "have not started",
                "nothing yet",
                "not started",
                "haven't studied",
                "have not studied",
            ),
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


class ActionRecommendGeneralSupport(Action):
    def name(self) -> Text:
        return "action_recommend_general_support"

    async def run(
        self,
        dispatcher: "CollectingDispatcher",
        tracker: Tracker,
        domain: "DomainDict",
    ) -> List[Dict[Text, Any]]:
        stress_feeling = tracker.get_slot("stress_feeling")
        immediate_needs = tracker.get_slot("immediate_needs")

        # Normalise slot values for simple rule-based checks.
        needs = str(immediate_needs or "").lower()

        # The user wants to settle down first.
        if mentions_any(
            needs,
            (
                "calm",
                "calm down",
                "calming",
                "settle",
                "relax",
                "relaxing",
                "breath",
                "breathe",
                "breathing",
                "rest",
            ),
        ):
            advice = (
                "Let's take it slow. Maybe it helps to breathe in for four "
                "counts and out for six, a few times in a row. No need to "
                "fix anything right now."
            )

        # The user wants a practical next step.
        elif mentions_any(
            needs,
            ("practical", "step", "steps", "plan", "planning", "do something"),
        ):
            advice = (
                "Okay, one small step then. Maybe it helps to write down "
                "what's on your mind, just a few words per thing. Then pick "
                "the one that feels easiest to start with."
            )

        # The user wants to talk, or does not know yet.
        else:
            advice = (
                f"Feeling {stress_feeling or 'like this'} can be a lot to "
                "carry. I'm happy to just listen. What's been on your mind "
                "the most today?"
            )

        dispatcher.utter_message(text=advice)
        return []


class ActionRecommendStressorNextStep(Action):
    def name(self) -> Text:
        return "action_recommend_stressor_next_step"

    async def run(
        self,
        dispatcher: "CollectingDispatcher",
        tracker: Tracker,
        domain: "DomainDict",
    ) -> List[Dict[Text, Any]]:
        stressor = tracker.get_slot("stressor")
        stressor_timing = tracker.get_slot("stressor_timing")
        desired_outcome = tracker.get_slot("desired_outcome")

        # Normalise slot values for simple rule-based checks.
        timing = str(stressor_timing or "").lower()
        outcome = str(desired_outcome or "").strip()

        # The situation is happening right now.
        if mentions_any(timing, ("now", "right now", "today", "currently")):
            advice = (
                f"{stressor or 'This'} is happening right now, so let's keep "
                "it small. Maybe it helps to take a short pause, a few slow "
                "breaths or a sip of water, before you take the next step."
            )

        # A specific worry or wish has been identified.
        elif outcome:
            advice = (
                f"So you're worried about {outcome}. Maybe it helps to "
                "split it into what you can and can't control. Pick one "
                "small thing from the first group that you could do today."
            )

        # General fallback.
        else:
            advice = (
                f"For {stressor or 'this situation'}, maybe it helps to "
                "think of one small thing you could do to feel a bit more "
                "prepared. It doesn't have to solve everything."
            )

        dispatcher.utter_message(text=advice)
        return []
