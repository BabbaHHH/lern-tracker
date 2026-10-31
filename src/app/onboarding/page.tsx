"use client";
import {useAccountLearningMode} from '@/components/account-learning-boundary';
import {AccountProfilePage} from '@/components/account-profile-page';
import {OriginalOnboardingView} from '@/components/account-onboarding-original';
export default function OnboardingPage(){return useAccountLearningMode()?<AccountProfilePage/>:<OriginalOnboardingView/>;}
