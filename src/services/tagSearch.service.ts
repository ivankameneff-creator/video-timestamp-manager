import { normalizeTagName } from "@/lib/timecode";
import { tagRepository } from "@/repositories/tag.repository";
import { videoRepository } from "@/repositories/video.repository";
import type {
  SearchResponseDTO,
  TimestampSearchHit,
  VideoDTO,
} from "@/types/cinema.types";

export const tagSearchService = {
  searchByKeyword(rawQuery: string, folderFilter?: string): SearchResponseDTO {
    const normalizedQuery = normalizeTagName(rawQuery);
    const queryTokens = normalizedQuery.split(" ").filter(Boolean);

    let allVideos = videoRepository.findAll({ includeMissing: false });

    if (folderFilter && folderFilter !== "/") {
      allVideos = allVideos.filter(
        (v) =>
          v.folderPath === folderFilter ||
          v.folderPath.startsWith(`${folderFilter}/`)
      );
    }

    const availableTags = tagRepository.listAllTagsWithCounts();

    // Sans filtre de mot-clé : retourne toutes les séquences horodatées et les vidéos
    if (queryTokens.length === 0) {
      const allTimestampHits: TimestampSearchHit[] = [];
      for (const video of allVideos) {
        for (const ts of video.timestampTags) {
          allTimestampHits.push({
            id: ts.id,
            timestampSec: ts.timestampSec,
            tagName: ts.tagName,
            label: ts.label,
            video: {
              id: video.id,
              title: video.title,
              relativePath: video.relativePath,
              folderPath: video.folderPath,
              globalTags: video.globalTags.map((g) => g.name),
            },
          });
        }
      }

      return {
        query: "",
        timestampHits: allTimestampHits,
        videoHits: allVideos,
        availableTags,
      };
    }

    const timestampHits: TimestampSearchHit[] = [];
    const videoHits: VideoDTO[] = [];

    for (const video of allVideos) {
      const globalTagNames = video.globalTags.map((t) => t.name);
      const videoSearchableText = [
        video.title.toLowerCase(),
        video.folderPath.toLowerCase(),
        ...globalTagNames,
      ].join(" ");

      let hasMatchingTimestamp = false;

      // 1. Recherche dans les tags horodatés (priorité métier : aller au timestamp)
      for (const ts of video.timestampTags) {
        const tsSearchable = [
          ts.tagName,
          ts.label?.toLowerCase() ?? "",
          ...globalTagNames,
        ].join(" ");

        const matchesAllTokens = queryTokens.every(
          (token) =>
            ts.tagName.includes(token) ||
            (ts.label?.toLowerCase().includes(token) ?? false) ||
            tsSearchable.includes(token)
        );

        const directTsMatch = queryTokens.some(
          (token) =>
            ts.tagName.includes(token) ||
            (ts.label?.toLowerCase().includes(token) ?? false)
        );

        if (matchesAllTokens && directTsMatch) {
          hasMatchingTimestamp = true;
          timestampHits.push({
            id: ts.id,
            timestampSec: ts.timestampSec,
            tagName: ts.tagName,
            label: ts.label,
            video: {
              id: video.id,
              title: video.title,
              relativePath: video.relativePath,
              folderPath: video.folderPath,
              globalTags: globalTagNames,
            },
          });
        }
      }

      // 2. Recherche sur les tags globaux ou le titre de la vidéo
      const matchesVideoGlobally = queryTokens.every((token) =>
        videoSearchableText.includes(token)
      );

      if (matchesVideoGlobally || hasMatchingTimestamp) {
        videoHits.push(video);
      }
    }

    // Tri par pertinence : correspondance exacte du mot-clé en tête, puis ordre chronologique
    timestampHits.sort((a, b) => {
      const aExact = a.tagName === normalizedQuery ? 0 : 1;
      const bExact = b.tagName === normalizedQuery ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      if (a.video.title !== b.video.title) {
        return a.video.title.localeCompare(b.video.title);
      }
      return a.timestampSec - b.timestampSec;
    });

    return {
      query: rawQuery.trim(),
      timestampHits,
      videoHits,
      availableTags,
    };
  },
};
