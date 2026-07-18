import { DomainCategory } from "../types";

export const DOMAIN_REGISTRY: Record<
  DomainCategory,
  string[]
> = {
  research: [
    "pubmed.ncbi.nlm.nih.gov",
    "ncbi.nlm.nih.gov",
    "nejm.org",
    "jamanetwork.com",
    "thelancet.com",
    "bmj.com",
    "nature.com",
    "sciencedirect.com",
    "springer.com",
    "wiley.com",
    "frontiersin.org",
    "plos.org",
    "mdpi.com",
    "researchgate.net",
  ],

  government: [
    "fda.gov",
    "cdc.gov",
    "nih.gov",
    "hhs.gov",
    "cms.gov",
    "gov.uk",
    "canada.ca",
    "europa.eu",
    "ema.europa.eu",
    "who.int",
    "clinicaltrials.gov",
  ],

  medical_society: [
    "ama-assn.org",
    "aad.org",
    "plasticsurgery.org",
    "asps.org",
    "acc.org",
    "heart.org",
    "asco.org",
    "ashp.org",
  ],

  advocacy: [
    "patientadvocacy.org",
    "globalgenes.org",
    "rarediseases.org",
    "nord.org",
  ],

  forum: [
    "reddit.com",
    "quora.com",
    "healthunlocked.com",
    "patient.info",
    "inspire.com",
  ],

  social: [
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "threads.net",
    "bsky.app",
  ],

  video: [
    "youtube.com",
    "youtu.be",
    "vimeo.com",
  ],

  podcast: [
    "spotify.com",
    "podcasts.apple.com",
    "podbean.com",
    "buzzsprout.com",
    "anchor.fm",
  ],

  retail: [
    "amazon.com",
    "sephora.com",
    "ulta.com",
    "walmart.com",
    "target.com",
    "boots.com",
    "ebay.com",
  ],

  press_release: [
    "prnewswire.com",
    "businesswire.com",
    "globenewswire.com",
    "einpresswire.com",
    "accesswire.com",
  ],

  healthcare_trade: [
    "fiercepharma.com",
    "fiercehealthcare.com",
    "statnews.com",
    "medscape.com",
    "modernhealthcare.com",
    "pharmavoice.com",
    "endpointsnews.com",
  ],

  healthcare_news: [
    "medicalnewstoday.com",
    "healthline.com",
    "webmd.com",
    "verywellhealth.com",
  ],

  consumer_news: [
    "cnn.com",
    "bbc.com",
    "forbes.com",
    "newsweek.com",
    "usatoday.com",
    "huffpost.com",
    "independent.co.uk",
    "dailymail.co.uk",
  ],

  clinic: [],

  blog: [
    "medium.com",
    "substack.com",
    "wordpress.com",
    "blogspot.com",
  ],

  unknown: [],
};

export function domainMatches(
  domain: string,
  registeredDomain: string
): boolean {
  const normalizedDomain = domain
    .toLowerCase()
    .replace(/^www\./, "");

  const normalizedRegistered =
    registeredDomain
      .toLowerCase()
      .replace(/^www\./, "");

  return (
    normalizedDomain === normalizedRegistered ||
    normalizedDomain.endsWith(
      `.${normalizedRegistered}`
    )
  );
}