"use client";
import {useAccountPersonal} from '@/lib/learning/use-account-personal';
import {settingsAccountKey} from '@/lib/learning/settings-contract';
import {AccountPersonalStatus} from './account-personal-status';
import {OriginalOnboardingView} from './account-onboarding-original';
export function AccountProfilePage(){
 const personal=useAccountPersonal();
 return <>{(personal.status!=='ready'||personal.message)&&<div className="max-w-3xl mx-auto w-full px-4"><AccountPersonalStatus {...personal}/></div>}{personal.view&&<div hidden={personal.status!=='ready'} key={settingsAccountKey(personal.view.account)}><OriginalOnboardingView account={{view:personal.view,busy:personal.busy,save:personal.saveProfile}}/></div>}</>;
}
