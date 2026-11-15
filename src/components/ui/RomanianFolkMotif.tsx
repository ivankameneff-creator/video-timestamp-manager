interface RomanianEmblemProps {
  className?: string;
}

/**
 * Rosace géométrique inspirée des broderies roumaines au point de croix (Steaua / Rombul Cusut)
 */
export function RomanianEmblem({ className = "h-7 w-7" }: RomanianEmblemProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Losange extérieur en point de croix carmin */}
      <path
        d="M18 2L34 18L18 34L2 18L18 2Z"
        stroke="#B81D24"
        strokeWidth="2.2"
      />
      {/* Crochets d'angle traditionnels (Cârlige) en encre anthracite */}
      <path
        d="M18 7L29 18L18 29L7 18L18 7Z"
        stroke="#1E1614"
        strokeWidth="1.6"
      />
      {/* Étoile centrale brodée */}
      <path
        d="M18 11L25 18L18 25L11 18L18 11Z"
        fill="#B81D24"
      />
      {/* Point central Bleu de Voroneț & éclats dorés */}
      <rect x="16.2" y="16.2" width="3.6" height="3.6" fill="#FAF6EE" />
      <rect x="17" y="17" width="2" height="2" fill="#1D4E89" />
      <rect x="17" y="3.5" width="2" height="2" fill="#D99B26" />
      <rect x="17" y="30.5" width="2" height="2" fill="#D99B26" />
      <rect x="3.5" y="17" width="2" height="2" fill="#D99B26" />
      <rect x="30.5" y="17" width="2" height="2" fill="#D99B26" />
    </svg>
  );
}

/**
 * Frise horizontale traditionnelle roumaine (Cusătură cu Romburi / Coloana Infinitului)
 */
export function RomanianStitchFrieze({
  patternId = "romanian-stitch-pattern",
}: {
  patternId?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className="w-full overflow-hidden border-y border-line bg-elevated/85"
    >
      <svg className="block h-4 w-full" preserveAspectRatio="none">
        <defs>
          <pattern
            id={patternId}
            x="0"
            y="0"
            width="48"
            height="16"
            patternUnits="userSpaceOnUse"
          >
            {/* Losange principal Rouge Roumain */}
            <path
              d="M12 2L20 8L12 14L4 8Z"
              fill="none"
              stroke="#B81D24"
              strokeWidth="1.6"
            />
            <rect x="10.8" y="6.8" width="2.4" height="2.4" fill="#B81D24" />

            {/* Motif croisé intermédiaire Noir Cărbune & Bleu Voroneț */}
            <path
              d="M32 4L36 8L32 12L28 8Z"
              fill="none"
              stroke="#1E1614"
              strokeWidth="1.3"
            />
            <rect x="31" y="7" width="2" height="2" fill="#1D4E89" />

            {/* Points de liaison dorés */}
            <circle cx="24" cy="8" r="1.2" fill="#C98A18" />
            <circle cx="0" cy="8" r="1.2" fill="#C98A18" />
            <circle cx="48" cy="8" r="1.2" fill="#C98A18" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
      </svg>
    </div>
  );
}
