// Final recorded pass (missions): re-issued with the authored hand-in; the five missions are unchanged.
// The story of Neon Tide, as data: five missions Rosa Delgado hands Marco Vidal from the
// Palms Motel, each a short chain of steps the world runs. Step kinds: goto (reach the gold
// marker), enterCar (be sitting in a car at the marker), steal (get into the marked car),
// deliver (reach the marker in the marked car), collect (pick up the bag at the marker) and
// escape (reach the marker while the heat is on). `at` names a point of interest in city.js.

export const MISSIONS = [
  {
    title: 'First Wheels',
    reward: 150,
    intro: [
      'Rosa: Marco! You came. Coral Bay missed its favourite driver.',
      'Marco: I came for quiet, Rosa. One job. Maybe two.',
      'Rosa: Quiet pays nothing, baby. My Marlin is parked round the side — take it down to Pier 9 and let the dock crew see your face.',
    ],
    steps: [
      { kind: 'enterCar', at: 'motelCar', text: 'Get in the Marlin parked by the motel' },
      { kind: 'goto', at: 'docks', needCar: true, text: 'Drive to Pier 9 at the docks' },
    ],
    outro: [
      'Dockhand: Rosa’s boy, huh? Tell her the pier remembers him.',
      'Rosa (phone): See? Easy money. Come back to me, I have more.',
    ],
  },
  {
    title: 'The Package',
    reward: 300,
    intro: [
      'Rosa: A package came off a boat last night. It is sitting at Pier 9 with my name on it.',
      'Marco: And the harbour patrol with binoculars?',
      'Rosa: Move quick and they see nothing. Drop it at Sunset Pawn. Oh — and take my pistol. Just in case.',
    ],
    steps: [
      { kind: 'goto', at: 'docks', text: 'Collect the package at Pier 9', setWanted: 1 },
      { kind: 'goto', at: 'pawn', text: 'Deliver the package to Sunset Pawn' },
    ],
    outro: [
      'Pawnbroker: Rosa always pays her debts. Tell her we are square.',
      'Marco: Square. Sure. Everyone is square until the tide comes in.',
    ],
    giveGun: true,
  },
  {
    title: 'Beachfront Boost',
    reward: 500,
    intro: [
      'Rosa: See that yellow Vantara GT by the beach lot? A dealer left it running and walked away.',
      'Marco: You want me to steal a sports car in broad daylight.',
      'Rosa: I want you to liberate it. Torque & Tide will take it in, no questions. The CBPD will ask some.',
    ],
    steps: [
      { kind: 'goto', at: 'beachLot', text: 'Go to the beachfront lot' },
      { kind: 'steal', at: 'beachLot', text: 'Steal the yellow Vantara GT', setWanted: 2 },
      { kind: 'deliver', at: 'garage', text: 'Deliver the Vantara to Torque & Tide Garage' },
    ],
    outro: [
      'Mechanic: She is beautiful. Rosa said you would bring her home.',
      'Marco: Tell Rosa the whole bay watched me do it.',
    ],
  },
  {
    title: 'Three Bags',
    reward: 800,
    intro: [
      'Rosa: Three drops, one afternoon. Cash bags — one in Palms Park, one downtown, one on the beach.',
      'Marco: And every bag makes me more popular with the CBPD.',
      'Rosa: Popular pays, baby. Bring them all back to the motel.',
    ],
    steps: [
      { kind: 'collect', at: 'park', text: 'Pick up the cash bag in Palms Park' },
      { kind: 'collect', at: 'alley', text: 'Pick up the cash bag downtown', setWanted: 1 },
      { kind: 'collect', at: 'beach', text: 'Pick up the cash bag on the beach', setWanted: 2 },
      { kind: 'goto', at: 'motel', text: 'Bring the bags back to the Palms Motel' },
    ],
    outro: [
      'Rosa: All three. You still have the touch, Marco.',
      'Marco: The touch is getting heavy, Rosa. One more job. Then I am done.',
    ],
  },
  {
    title: 'Last Tide',
    reward: 1500,
    intro: [
      'Rosa: The pawnbroker talked. The CBPD are coming for you tonight — all of them.',
      'Marco: Then I am gone. There is a boat waiting at the pier, east end of the bay.',
      'Rosa: Drive like the tide, Marco. Do not stop for anybody.',
    ],
    steps: [
      { kind: 'escape', at: 'pier', text: 'Reach the boat at the end of the pier', setWanted: 3 },
    ],
    outro: [
      'Marco: Tell Coral Bay I will send a postcard.',
      'Rosa (phone): You already did, baby. It is written all over the evening news.',
    ],
  },
];

/** The line shown on the title screen once the story is done. */
export const FREE_ROAM_TEXT = 'The tide is yours. Coral Bay is an open city — earn, drive, and stay ahead of the CBPD.';
