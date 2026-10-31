import type {OnboardingData} from '@/lib/store';
import {manualProfileDraft,type PersonalView,type ProfilePatch} from '@/lib/learning/personal-contract';
import {projectProfile} from '@/lib/learning/profile-fields';
/** Display defaults never become a write merely by opening a wizard step. */
export const accountOnboardingData=(view:PersonalView):OnboardingData=>({...manualProfileDraft(view),documents:[]});
export function editedProfilePatch(before:Partial<OnboardingData>,edited:Partial<OnboardingData>):ProfilePatch {
 const allowed=projectProfile(edited as Record<string,unknown>);
 const patch=Object.fromEntries(Object.entries(allowed).filter(([key,value])=>JSON.stringify(before[key as keyof OnboardingData])!==JSON.stringify(value))) as ProfilePatch;
 if(patch.studyPlanningMode!==undefined||patch.studyPhasesEnabled!==undefined){const mode=patch.studyPlanningMode??(patch.studyPhasesEnabled===false?'custom':'station');patch.studyPlanningMode=mode;patch.studyPhasesEnabled=mode==='station';}
 return patch;
}
