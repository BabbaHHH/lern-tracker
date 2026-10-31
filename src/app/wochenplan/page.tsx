"use client";
import {useAccountLearningMode} from '@/components/account-learning-boundary';
import {AccountCalendarPage} from '@/components/account-schedule';
import {OriginalWeekView} from '@/components/account-calendar-week';
export default function LernkalenderPage(){return useAccountLearningMode()?<AccountCalendarPage mode="week"/>:<OriginalWeekView/>;}
