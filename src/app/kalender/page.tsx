"use client";
import {useAccountLearningMode} from '@/components/account-learning-boundary';
import {AccountCalendarPage} from '@/components/account-schedule';
import {OriginalMonthView} from '@/components/account-calendar-month';
export default function KalenderPage(){return useAccountLearningMode()?<AccountCalendarPage mode="month"/>:<OriginalMonthView/>;}
