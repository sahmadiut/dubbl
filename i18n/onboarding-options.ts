import type { useTranslations } from "next-intl";
import type { Country } from "@/lib/data/business-types";
import type { Industry } from "@/lib/data/industries";
import type { ReferralSource } from "@/lib/data/referral-sources";

type Translate = ReturnType<typeof useTranslations<"OnboardingOptions">>;
type OptionKey = Parameters<Translate>[0];
const countryKeys: Partial<Record<string, OptionKey>> = {
  "US": "country_US",
  "CA": "country_CA",
  "MX": "country_MX",
  "GB": "country_GB",
  "DE": "country_DE",
  "FR": "country_FR",
  "NL": "country_NL",
  "ES": "country_ES",
  "IT": "country_IT",
  "SE": "country_SE",
  "DK": "country_DK",
  "NO": "country_NO",
  "FI": "country_FI",
  "BE": "country_BE",
  "PT": "country_PT",
  "PL": "country_PL",
  "CZ": "country_CZ",
  "CH": "country_CH",
  "AT": "country_AT",
  "IE": "country_IE",
  "AU": "country_AU",
  "NZ": "country_NZ",
  "JP": "country_JP",
  "IN": "country_IN",
  "SG": "country_SG",
  "HK": "country_HK",
  "KR": "country_KR",
  "CN": "country_CN",
  "TH": "country_TH",
  "ID": "country_ID",
  "PH": "country_PH",
  "VN": "country_VN",
  "TW": "country_TW",
  "BR": "country_BR",
  "AE": "country_AE",
  "SA": "country_SA",
  "IL": "country_IL",
  "ZA": "country_ZA",
  "NG": "country_NG",
  "KE": "country_KE"
};
const industryKeys: Partial<Record<string, OptionKey>> = {
  "technology": "industry_technology",
  "retail": "industry_retail",
  "healthcare": "industry_healthcare",
  "finance": "industry_finance",
  "education": "industry_education",
  "manufacturing": "industry_manufacturing",
  "professional_services": "industry_professional_services",
  "food_beverage": "industry_food_beverage",
  "real_estate": "industry_real_estate",
  "construction": "industry_construction",
  "transportation": "industry_transportation",
  "entertainment": "industry_entertainment",
  "agriculture": "industry_agriculture",
  "nonprofit": "industry_nonprofit",
  "other": "industry_other"
};
const referralKeys: Partial<Record<string, OptionKey>> = {
  "search_engine": "referral_search_engine",
  "social_media": "referral_social_media",
  "friend_colleague": "referral_friend_colleague",
  "github": "referral_github",
  "blog_article": "referral_blog_article",
  "youtube": "referral_youtube",
  "reddit": "referral_reddit",
  "hacker_news": "referral_hacker_news",
  "other": "referral_other"
};

// Labels are presentation only. Existing canonical names/codes still own writes.
export function countryName(t: Translate, country: Country) {
  const key = Object.hasOwn(countryKeys, country.code) ? countryKeys[country.code] : undefined;
  return key ? t(key) : country.name;
}
export function industryName(t: Translate, industry: Industry) {
  const key = Object.hasOwn(industryKeys, industry.code) ? industryKeys[industry.code] : undefined;
  return key ? t(key) : industry.name;
}
export function referralName(t: Translate, referral: ReferralSource) {
  const key = Object.hasOwn(referralKeys, referral.code) ? referralKeys[referral.code] : undefined;
  return key ? t(key) : referral.name;
}
