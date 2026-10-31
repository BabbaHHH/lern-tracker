"use client";
import {useAccountLearningMode} from "@/components/account-learning-boundary";
import {AccountSettingsPage} from "@/components/account-settings-page";
import {OriginalSettingsView} from "@/components/account-settings-original";
export default function AdminPage(){return useAccountLearningMode()?<AccountSettingsPage/>:<OriginalSettingsView/>;}
