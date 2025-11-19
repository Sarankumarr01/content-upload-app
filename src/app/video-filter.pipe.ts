import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'videoFilter',
  standalone: true
})
export class VideoFilterPipe implements PipeTransform {
  transform(videos: any[], term: string): any[] {
    if (!videos) return [];
    if (!term) return videos;

    term = term.toLowerCase();

    return videos.filter(v =>
      v.title?.toLowerCase().includes(term) ||
      v.description?.toLowerCase().includes(term)
    );
  }
}
