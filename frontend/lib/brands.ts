// The demo brands. Onboarding shows them; the search agent (app/onboarding/streams) looks for `short` in titles and
// for live streams in `fits`, which are Twitch categories.
export const BRANDS = [
  { id: "gatorade", name: "Gatorade", short: "Gatorade", kind: "Sports drink", color: "#FF7A1A", product: "bottle", fits: ["Fitness & Health", "Sports", "NBA 2K27"],
    profile: [
      ["Product", "Sports drink in 20 oz and 28 oz bottles, plus Gatorade Zero and G2."],
      ["Looks like", "Orange bolt logo and the Gatorade wordmark, coloured drink visible through the bottle."],
      ["Sounds like", "“Gatorade”, “Gatorade Zero”, “G2”, “the blue one”."],
      ["Fits with", "Gym, running, team sports, esports and long gaming sessions."],
      ["Voice", "Short and upbeat. Signs off “Stay hydrated.”"],
      ["Never pay for", "Competitor bottles in frame (Powerade, Prime, BodyArmor), alcohol, creators under 18."],
    ] },
  { id: "northline", name: "Northline Cold Brew", short: "Northline", kind: "Canned cold brew coffee", color: "#C6F432", product: "can", fits: ["Co-working & Studying", "Food & Drink", "Just Chatting"],
    profile: [
      ["Product", "Cold brew coffee in a slim 250 ml can, black or oat."],
      ["Looks like", "Matte black can, lime horizon line, lowercase wordmark."],
      ["Sounds like", "“Northline”, “the black can”, “my cold brew”."],
      ["Fits with", "Morning streams, study and work-with-me, cooking."],
      ["Voice", "Dry and calm. Signs off “Steady on.”"],
      ["Never pay for", "Other coffee brands in frame, energy drinks, creators under 18."],
    ] },
  { id: "fernway", name: "Fernway Sparkling", short: "Fernway", kind: "Sparkling mineral water", color: "#4DA3FF", product: "can", fits: ["Travel & Outdoors", "Food & Drink", "Just Chatting"],
    profile: [
      ["Product", "Sparkling mineral water in a 330 ml can, three flavours."],
      ["Looks like", "Pale blue can, line-drawn fern, FERNWAY in tall capitals."],
      ["Sounds like", "“Fernway”, “the fern can”, “sparkling water”."],
      ["Fits with", "Outdoor vlogs, running, cooking, slow chat streams."],
      ["Voice", "Warm and light. Signs off “Stay fresh.”"],
      ["Never pay for", "Competitor cans in frame, alcohol mixers, creators under 18."],
    ] },
];
