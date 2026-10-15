import type { CreateRunInput } from "@overlap/shared";

export interface Preset extends CreateRunInput {
  id: string;
  blurb: string;
}

export const presets: Preset[] = [
  {
    id: "phoebe-us",
    blurb: "Indie artist, five-city US tour",
    propertyType: "artist_tour",
    propertyName: "Phoebe Bridgers: US tour",
    artists: [{ query: "Phoebe Bridgers" }],
    cities: ["Chicago", "Austin", "New York City", "Los Angeles", "Seattle"],
    categories: ["drinks", "electronics", "fashion", "travel"],
  },
  {
    id: "badbunny-intl",
    blurb: "Latin superstar with an international leg",
    propertyType: "artist_tour",
    propertyName: "Bad Bunny: Americas & Europe leg",
    artists: [{ query: "Bad Bunny" }],
    cities: ["Chicago", "Miami", "Mexico City", "Madrid", "London"],
    categories: ["drinks", "telecom", "automotive", "fashion"],
  },
  {
    id: "riverlight-festival",
    blurb: "Fictional Austin festival, three headliners",
    propertyType: "festival",
    propertyName: "Riverlight Festival (fictional), Austin",
    artists: [{ query: "Khruangbin" }, { query: "Phoebe Bridgers" }, { query: "Bad Bunny" }],
    cities: ["Austin"],
    categories: ["drinks", "travel", "financial_services", "telecom"],
  },
];
