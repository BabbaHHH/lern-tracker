"use client";
import {useAccountLearningMode} from '@/components/account-learning-boundary';
import {AccountPlanPage,OriginalPlanView} from '@/components/account-plan-page';
export default function PlanPage(){return useAccountLearningMode()?<AccountPlanPage/>:<OriginalPlanView/>;}
