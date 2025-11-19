import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sortVideos',
  standalone: true
})
export class SortVideosPipe implements PipeTransform {

  transform(list: any[], mode: string): any[] {
    if (!list || !mode) return list;

    return [...list].sort((a, b) => {
      switch (mode) {

        case 'az':
          return a.title.localeCompare(b.title);

        case 'za':
          return b.title.localeCompare(a.title);

        case 'newest':
          return (b.createdAt?.toMillis?.() || 0) -
                 (a.createdAt?.toMillis?.() || 0);

        case 'oldest':
          return (a.createdAt?.toMillis?.() || 0) -
                 (b.createdAt?.toMillis?.() || 0);

        default:
          return 0;
      }
    });
  }
}
