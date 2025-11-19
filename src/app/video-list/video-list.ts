import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { query, where, getDocs } from '@angular/fire/firestore';
import { SortVideosPipe } from '../sort-videos.pipe';

import {
  Firestore,
  collection,
  collectionData,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  addDoc,
} from '@angular/fire/firestore';

import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  uploadBytesResumable,
} from '@angular/fire/storage';

import { Observable, map } from 'rxjs';
import { VideoFilterPipe } from '../video-filter.pipe';

interface Video {
  id?: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  videoPath?: string;
  size?: number;
  createdAt?: any;
  visibility?: 'visible' | 'hidden';
  deletedAt?: any;
  mediaType?: 'video' | 'audio' | 'image';
  duration?: string;
}

/** Simple audio icon SVG – will be turned into a data URL at runtime */
const AUDIO_ICON_SVG = `
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <!-- Music Note -->
  <path d="M40 18v22.5a6 6 0 1 1-4-5.2V22l-10 2v16.5a6 6 0 1 1-4-5.2V20l18-4z"
        fill="#2563eb"/>
</svg>
`;

@Component({
  selector: 'app-video-list',
  standalone: true,
  imports: [CommonModule, FormsModule, VideoFilterPipe, SortVideosPipe],
  template: `
  <div class="list-wrapper">
    <!-- toolbar -->
    <div class="toolbar">
      <div class="left">
        <div class="tabs">
          <button [class.active]="tab==='all'"    (click)="tab='all'">All</button>
          <button [class.active]="tab==='videos'" (click)="tab='videos'">Videos</button>
          <button [class.active]="tab==='audio'"  (click)="tab='audio'">Audio</button>
          <button [class.active]="tab==='image'"  (click)="tab='image'">Image</button>
        </div>
      </div>
      <div class="right">
        <button class="btn-upload" (click)="openUploadModal()">Upload</button>
        <button class="btn-export" (click)="onExport()">Export</button>
      </div>
    </div>

    <!-- filters row -->
    <div class="filters">
      <input
        type="text"
        placeholder="Search title or description"
        [(ngModel)]="searchTerm"
      />
      <select [(ngModel)]="sortMode" class="small">
        <option value="">Sort</option>
        <option value="az">A → Z</option>
        <option value="za">Z → A</option>
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
      </select>

      <input type="date" [(ngModel)]="dateFilter" />
      <button class="small" (click)="clearFilters()">Clear</button>
    </div>

    <!-- table -->
    <div class="table-wrap" *ngIf="videos$ | async as videos; else loading">
      <div class="selected-bar" *ngIf="selectedIds.size">
        <span>{{selectedIds.size}} selected</span>
        <button (click)="bulkMoveToBin(videos)" class="danger">Move selected to Bin</button>
      </div>

      <table class="video-table">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                [checked]="allSelected(filteredByTab(videos))"
                (change)="toggleSelectAll($event, filteredByTab(videos))"
              />
            </th>
            <th style="padding-right:50px">Thumb</th>
            <th>Title</th>
            <th>Description</th>
            <th>Duration</th>
            <th>Size</th>
            <th>Created</th>
            <th>Visibility</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          <tr *ngFor="let v of (filteredByTab(videos) | videoFilter: searchTerm | sortVideos: sortMode)">

            <td>
              <input
                type="checkbox"
                [checked]="selectedIds.has(v.id)"
                (change)="toggleSelect(v)"
              />
            </td>

            <td>
              <img
                *ngIf="v.thumbnailUrl; else placeholder"
                [src]="v.thumbnailUrl"
                class="thumb"
              />
              <ng-template #placeholder>
                <div class="thumb placeholder-thumb"></div>
              </ng-template>
            </td>

            <td class="title">{{ v.title }}</td>
            <td class="desc">{{ v.description || '-' }}</td>
            <td>{{ v.duration || '-' }}</td>
            <td>{{ formatSize(v.size) }}</td>
            <td class="muted small">
              {{ v.createdAt?.toDate?.() | date:'dd MMM yyyy' }}
            </td>

            <td>
              <span
                class="badge"
                [class.visible]="v.visibility==='visible'"
                [class.hidden]="v.visibility==='hidden'"
              >
                {{ v.visibility || 'visible' }}
              </span>
            </td>

            <td class="actions">
              <button title="View" (click)="onView(v)">🔍</button>
              <button title="Edit" (click)="onEdit(v)">✏</button>
              <button (click)="download(v)">⬇</button>

              <button
                title="Move to Bin"
                class="danger"
                (click)="openDeleteDialog(v)"
              >
                🗑
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- pager -->
      <div class="pager">
        <button (click)="prevPage()">‹ Prev</button>
        <span>Page {{page}}</span>
        <button (click)="nextPage()">Next ›</button>
      </div>
    </div>

    <ng-template #loading>
      <p>Loading…</p>
    </ng-template>

    <!-- EDIT MODAL -->
    <div class="edit-modal" *ngIf="editing">
      <div class="edit-box">
        <h3>Edit Media</h3>

        <label>Title</label>
        <input type="text" [(ngModel)]="editData.title" />

        <label>Description</label>
        <textarea [(ngModel)]="editData.description"></textarea>

        <label>Visibility</label>
        <select [(ngModel)]="editData.visibility">
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </select>

        <div class="edit-actions">
          <button class="save" (click)="saveEdit()">Save</button>
          <button class="cancel" (click)="cancelEdit()">Cancel</button>
        </div>
      </div>
    </div>

    <!-- DELETE CONFIRM MODAL -->
    <div class="modal-backdrop" *ngIf="confirmDeleteVideo">
      <div class="modal">
        <h3>Move to Recycle Bin?</h3>
        <p>
          {{ confirmDeleteVideo.title }} will be moved to the Recycle Bin.
          You can restore it later or delete it permanently from there.
        </p>
        <div class="modal-actions">
          <button class="btn-secondary" (click)="cancelDelete()">Cancel</button>
          <button class="btn-danger" (click)="confirmDelete()">Move to Bin</button>
        </div>
      </div>
    </div>

    <!-- UNAUTHORIZED MODAL -->
    <div class="modal-backdrop" *ngIf="unauthorizedMessage">
      <div class="modal">
        <h3 style="color:#dc2626; font-weight:700; font-size:20px;">
          ⚠ Unauthorized Action
        </h3>

        <p>{{ unauthorizedMessage }}</p>

        <div class="modal-actions">
          <button class="btn-primary" (click)="unauthorizedMessage = null">
            OK
          </button>
        </div>
      </div>
    </div>

    <!-- UPLOAD MODAL -->
    <div class="modal-backdrop" *ngIf="showUploadModal">
      <div class="modal upload-modal">
        <h3 class="modal-title">Upload Media</h3>

        <div class="upload-body">
          <div class="upload-drop-zone"
               [class.dragging]="isDragging"
               (dragover)="onDragOver($event)"
               (dragleave)="onDragLeave($event)"
               (drop)="onDrop($event)">
            <label class="file-select-btn">
              Choose Files
              <input
                type="file"
                multiple
                accept="video/*,image/*,audio/*"
                (change)="onFileInputChange($event)"
              />
            </label>

            <p class="file-name" *ngIf="uploadFiles.length">
              {{ uploadFiles.length }} file(s) selected
            </p>
            <p class="file-name muted" *ngIf="!uploadFiles.length">
              Drag & drop video, image, or audio files here, or click "Choose Files"
            </p>
          </div>

          <!-- PROGRESS BAR -->
          <div class="progress-container" *ngIf="uploading">
            <div class="progress-bar" [style.width.%]="uploadProgress"></div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" (click)="closeUploadModal()" [disabled]="uploading">Cancel</button>
          <button class="btn-primary" (click)="startUpload()" [disabled]="!uploadFiles.length || uploading">
            {{ uploading ? 'Uploading...' : 'Upload' }}
          </button>
        </div>

      </div>
    </div>

    <!-- UPLOAD SUCCESS / FAIL MODAL -->
    <div class="modal-backdrop" *ngIf="uploadStatus">
      <div class="modal">
        <h3>
          <span *ngIf="uploadStatus === 'Upload Successful'" 
                style="color:#16a34a; font-size:22px; font-weight:700;">✔️</span>

          <span *ngIf="uploadStatus !== 'Upload Successful'" 
                style="color:#dc2626; font-size:22px; font-weight:700;">❌</span>

          {{ uploadStatus }}
        </h3>

        <div class="modal-actions">
          <button class="btn-primary" (click)="uploadStatus = null">OK</button>
        </div>
      </div>
    </div>

  </div>
  `,
  styles: [`
    /* TABLE ALIGNMENT */
    .video-table {
      width: 100%;
      border-collapse: collapse;
    }

    .video-table th,
    .video-table td {
      padding: 1px 1px;
      vertical-align: middle;
    }

    .video-table th:nth-child(2),
    .video-table td:nth-child(2),
    .video-table th:nth-child(3),
    .video-table td:nth-child(3),
    .video-table th:nth-child(4),
    .video-table td:nth-child(4), 
    .video-table th:nth-child(5),
    .video-table td:nth-child(5),
    .video-table th:nth-child(6),
    .video-table td:nth-child(6),
    .video-table th:nth-child(7),
    .video-table td:nth-child(7),
    .video-table th:nth-child(8),
    .video-table td:nth-child(8),
    .video-table th:nth-child(9),
    .video-table td:nth-child(9) {
      text-align: center;
    }

    .video-table th:nth-child(2),
    .video-table td:nth-child(2) {
      width: 110px;
      text-align: center;
    }

    .video-table td.actions {
      text-align: center;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
    }

    .video-table td.actions button {
      margin: 0;
    }

    .video-table th:nth-child(3) {
      width: 280px;
      text-align: center;
    }

    .video-table td.title {
      width: 280px;
      display: flex;
      align-items: center;
      padding-left: 18px !important;
      padding-right: 18px !important;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* BUTTONS */
    .btn-upload {
      padding: 12px 30px;
      background: #2563eb;
      color: white;
      border-radius: 10px;
      border: none;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-upload:hover {
      background: #1d4ed8;
    }
    .btn-export {
      padding: 10px 20px;
      background: #fee2e2;
      color: #b91c1c;
      border-radius: 10px;
      border: 2px solid #fecaca;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: 0.2s;
    }
    .btn-export:hover {
      background: #fecaca;
      border-color: #fca5a5;
      color: #991b1b;
    }

    .list-wrapper {
      margin-top: -30px;
    }

    /* UPLOAD DROP ZONE */
    .upload-body {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .upload-drop-zone {
      border: 2px dashed #cbd5f5;
      border-radius: 10px;
      padding: 16px;
      text-align: center;
      transition: 0.15s ease;
    }

    .upload-drop-zone.dragging {
      background: #eff6ff;
      border-color: #2563eb;
    }

    .file-select-btn {
      display: inline-block;
      background: #2563eb;
      color: white;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }
    .file-select-btn input[type="file"] {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }

    .upload-body .file-name {
      margin-top: 12px;
      font-size: 14px;
      font-weight: 500;
    }

    .right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .thumb {
      width: 50px;
      height: 50px;
      border-radius: 8px;
      object-fit: cover;
    }
    .placeholder-thumb { background: #e2e8f0; }

    .video-table tbody td { padding: 8px 30px; font-size: 0.9rem; }

    .filters .small {
      background: #ffffff;
      border: 1px solid #d1d5db;
      padding: 6px 10px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 100;
      color: #0f172ac6;
    }

    .table-wrap .pager {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 12px;
      padding-top: 12px;
    }
    .table-wrap .pager button {
      background: #ffffff;
      border: 1px solid #d1d5db;
      padding: 6px 10px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 700;
      color: #0f172a;
      box-shadow: 0 1px 2px rgba(15,23,42,0.04);
    }
    .table-wrap .pager span {
      font-weight: 100;
      color: #1e293bb9;
      padding: 6px 8px;
      border-radius: 6px;
      background: transparent;
    }

    .filters input[type="date"],
    .filters input[type="text"],
    .filters select {
      height: 40px;
      line-height: 1.0;
    }

    .table-wrap .selected-bar .danger,
    .actions button.danger {
      background: transparent;
      border: 1px solid #fee2e2;
      color: #b91c1c;
      padding: 13.5px 12px;
      border-radius: 8px;
    }

    .video-table thead th {
      padding: 10px 12px;
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 600;
    }

    /* EDIT MODAL */
    .edit-modal {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0,0,0,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 20;
    }
    .edit-box {
      background: white;
      padding: 24px;
      width: 380px;
      border-radius: 12px;
      box-shadow: 0 4px 18px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .edit-box input,
    .edit-box textarea,
    .edit-box select {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
    }
    .edit-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 6px;
    }
    .edit-actions .save {
      background: #2563eb;
      border: none;
      padding: 8px 14px;
      border-radius: 8px;
      color: white;
      font-weight: 700;
      cursor: pointer;
    }
    .edit-actions .cancel {
      background: #e5e7eb;
      border: none;
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
    }

    .video-table tbody tr:nth-child(even) { background: #f9fafb; }
    .video-table td, .video-table th { border-bottom: 1px solid #e5e7eb; }
    .video-table {
      border: 0px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }

    :host { display:block; width:100%; }
    .toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:12px; }
    .toolbar .tabs button { margin-right:8px; padding:6px 10px; border-radius:8px; border:1px solid transparent; background:transparent; cursor:pointer; }
    .toolbar .tabs button.active { background:#eef2ff; border-color:#c7ddff; color:#1e3a8a; font-weight:700; }
    .toolbar .add { padding:15px 28px; font-size: 15px;   background:#2563eb; color:white; border-radius:8px; border:none; cursor:pointer; font-weight:700; }

    .filters { display:flex; gap:12px; align-items:center; margin-bottom:10px; }
    .filters input[type="text"], .filters select, .filters input[type="date"] {
      padding:8px 10px; border-radius:8px; border:1px solid #e6eefb; min-width:180px;
    }

    .selected-bar {
      background:#fff8f8;
      padding:8px 12px;
      border-radius:8px;
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:10px;
      border:1px solid #fee2e2;
    }

    .table-wrap {
      background: white;
      padding:12px;
      border-radius:10px;
      border:1px solid #eef2f7;
      box-shadow: 0 1px 6px rgba(0,0,0,0.03);
    }
    .video-table { width:100%; border-collapse:collapse; min-width:800px; }
    tbody td { padding:12px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }

    .thumb { width:80px; height:45px; background:#f8fafc; border-radius:6px; overflow:hidden; display:flex; align-items:center; justify-content:center; }
    .thumb img { width:100%; height:100%; object-fit:cover; }

    .title {
      font-weight: 700;
      color: #0f172a;
      max-width: 260px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      height: 45px;
    }

    .muted.small { color:#64748b; font-size:0.85rem; margin-top:6px; }
    .desc { color:#475569; font-size:0.95rem; }

    .badge {
      display: inline-block !important;
      padding: 4px 12px !important;
      border-radius: 999px !important;
      border: 1px solid #d1d5db !important;
      background: #f8fafc !important;
      font-weight: 600 !important;
      font-size: 0.8rem !important;
    }
    .badge.visible {
      background: #ecfeff !important;
      border-color: #bbf7d0 !important;
      color: #047857 !important;
    }
    .badge.hidden {
      background: #fff1f2 !important;
      border-color: #fecaca !important;
      color: #9f1239 !important;
    }

    .actions button { background:none; border:none; cursor:pointer; margin-left:6px; font-size:1rem; }
    .actions { min-width: 120px; white-space: nowrap; text-align: center; }

    .video-table td { vertical-align: middle; white-space: nowrap; }
    .video-table td.desc { white-space: normal; }

    .hidden-row { opacity:0.6; }

    .pager { display:flex; justify-content:flex-end; gap:12px; padding-top:12px; }

    .small { font-size:0.85rem; }
    .muted { color:#64748b; }

    /* MODALS */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15,23,42,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 30;
    }
    .modal {
      background: #ffffff;
      padding: 20px 24px;
      border-radius: 12px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 15px 40px rgba(15,23,42,0.25);
    }

    .upload-modal {
      max-width: 420px;
    }

    .modal-title {
      margin-bottom: 14px;
      font-size: 18px;
      font-weight: 700;
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
    }

    .btn-primary {
      background: #2563eb;
      color: white;
      padding: 8px 14px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-secondary {
      background: #e5e7eb;
      padding: 8px 14px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }

    .btn-danger {
      background: #ef4444;
      color: #ffffff;
      border-radius: 8px;
      border: none;
      padding: 8px 14px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }

    .progress-container {
      width: 100%;
      height: 8px;
      background: #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
      margin-top: 10px;
    }

    .progress-bar {
      height: 100%;
      background: #2563eb;
      transition: width 0.2s ease;
    }

    .file-name {
      margin-top: 8px;
    }
  `]
})
export class VideoListComponent {
  uploadFiles: File[] = [];
  isDragging = false;

  sortMode: 'az' | 'za' | 'newest' | 'oldest' | '' = '';

  exporting = false;
  exportProgress = 0;
  exportStatus: string | null = null;
  exportFiles: string[] = [];

  showUploadModal = false;
  uploadFile: File | null = null; // still here so old logic doesn't break
  uploading = false;
  uploadStatus: string | null = null;
  uploadProgress = 0;

  editing = false;
  editData: Video = {} as Video;

  firestore = inject(Firestore);
  storage = inject(Storage);

  tab: 'all' | 'videos' | 'audio' | 'image' = 'all';
  searchTerm = '';
  visibilityFilter = '';
  dateFilter: string | null = null;

  page = 1;
  selectedIds = new Set<string | undefined>();

  confirmDeleteVideo: Video | null = null;
  unauthorizedMessage: string | null = null;

  private readonly audioIconDataUrl =
    'data:image/svg+xml;utf8,' + encodeURIComponent(AUDIO_ICON_SVG);

  videos$: Observable<Video[]> = collectionData(
    collection(this.firestore, 'videos'),
    { idField: 'id' }
  ) as Observable<Video[]>;

  formatSize(bytes?: number) {
    if (!bytes) return '-';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? mb.toFixed(2) + ' MB' : Math.round(mb) + ' MB';
  }

  /** Convert seconds -> "MM:SS" or "H:MM:SS" */
  private formatDurationSeconds(seconds: number | null): string {
    if (seconds == null || !isFinite(seconds)) return '-';
    const total = Math.floor(seconds);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const two = (n: number) => n.toString().padStart(2, '0');
    if (h > 0) return `${h}:${two(m)}:${two(s)}`;
    return `${two(m)}:${two(s)}`;
  }

  /** Filter videos by current tab (All / Videos / Audio / Image) */
  filteredByTab(videos: Video[]): Video[] {
    if (this.tab === 'all') return videos;

    const type =
      this.tab === 'videos' ? 'video' :
      this.tab === 'audio'  ? 'audio' :
                              'image';

    return videos.filter(v => {
      const mt = v.mediaType || 'video';
      return mt === type;
    });
  }

  toggleSelect(v: Video | Event) {
    if ((v as any).target) return;
    const id = (v as Video).id;
    if (!id) return;
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
  }

  toggleSelectAll(ev: Event, videos: Video[]) {
    const checked = (ev.target as HTMLInputElement).checked;
    if (checked) videos.forEach(v => v.id && this.selectedIds.add(v.id));
    else this.selectedIds.clear();
  }

  allSelected(videos: Video[]) {
    if (!videos || videos.length === 0) return false;
    return videos.every(v => v.id && this.selectedIds.has(v.id));
  }

  openUploadModal() {
    // Everyone can OPEN modal; Firebase rules decide who can actually upload.
    this.showUploadModal = true;
    this.uploadFiles = [];
    this.uploadProgress = 0;
  }

  closeUploadModal() {
    if (!this.uploading) {
      this.showUploadModal = false;
      this.uploadFile = null;
      this.uploadFiles = [];
    }
  }

  selectUploadFiles(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.uploadFiles = Array.from(input.files || []);
  }

  onFileInputChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.addFiles(files);
    input.value = '';
  }

  onDragOver(ev: DragEvent) {
    ev.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(ev: DragEvent) {
    ev.preventDefault();
    this.isDragging = false;
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    this.isDragging = false;
    const files = Array.from(ev.dataTransfer?.files || []);
    this.addFiles(files);
  }

  private addFiles(files: File[]) {
    for (const f of files) {
      if (
        !f.type.startsWith('video/') &&
        !f.type.startsWith('image/') &&
        !f.type.startsWith('audio/')
      ) {
        continue;
      }

      const exists = this.uploadFiles.some(
        uf => uf.name === f.name && uf.size === f.size && uf.type === f.type
      );
      if (!exists) {
        this.uploadFiles.push(f);
      }
    }
  }

  // ---------- UPLOAD WITH UNAUTHORIZED MODAL ----------
  async startUpload() {
    if (!this.uploadFiles.length) return;

    this.uploading = true;
    this.uploadProgress = 0;

    let uploadedCount = 0;
    let duplicateCount = 0;      // already in "videos"
    let recycleDupCount = 0;     // already in "videos_deleted"
    let failedCount = 0;

    const totalFiles = this.uploadFiles.length;

    try {
      for (let i = 0; i < totalFiles; i++) {
        const file = this.uploadFiles[i];

        // 1) Check active videos collection
        const videosRef = collection(this.firestore, 'videos');
        const qRef = query(videosRef, where('title', '==', file.name));
        const existing = await getDocs(qRef);

        if (!existing.empty) {
          duplicateCount++;
          // overall progress based on completed files
          this.uploadProgress = Math.round(((i + 1) / totalFiles) * 100);
          continue;
        }

        // 2) Check recycle bin (videos_deleted) as well
        const binRef = collection(this.firestore, 'videos_deleted');
        const binQuery = query(binRef, where('title', '==', file.name));
        const binExisting = await getDocs(binQuery);

        if (!binExisting.empty) {
          recycleDupCount++;
          // overall progress based on completed files
          this.uploadProgress = Math.round(((i + 1) / totalFiles) * 100);
          continue;
        }

        // 3) Actually upload
        let result: 'success' | 'failed' = 'failed';

        try {
          // pass index and total for overall progress calculation
          result = await this.uploadSingleFile(file, i, totalFiles);
        } catch (err: any) {
          if (err?.code === 'permission-denied') {
            this.unauthorizedMessage = 'Only authorized users can upload content.';

            this.uploading = false;
            return;
          }
          throw err;
        }

        if (result === 'success') uploadedCount++;
        else if (result === 'failed') failedCount++;
        // no manual progress set here; uploadSingleFile drives it
      }

      this.uploading = false;
      this.uploadFiles = [];
      this.showUploadModal = false;

      // Status messages
      if (uploadedCount && !failedCount && !duplicateCount && !recycleDupCount) {
        this.uploadStatus = 'Upload Successful';
      } else if (uploadedCount && (failedCount || duplicateCount || recycleDupCount)) {
        this.uploadStatus =
          `Uploaded ${uploadedCount} file(s). ` +
          (duplicateCount ? `${duplicateCount} duplicate(s) skipped. ` : '') +
          (recycleDupCount ? `${recycleDupCount} file(s) already in Recycle Bin. ` : '') +
          (failedCount ? `${failedCount} failed.` : '');
      } else if (!uploadedCount && duplicateCount && !failedCount && !recycleDupCount) {
        this.uploadStatus = 'File already uploaded';
      } else if (!uploadedCount && recycleDupCount && !failedCount && !duplicateCount) {
        this.uploadStatus = 'File already exists in Recycle Bin';
      } else {
        this.uploadStatus = 'Upload Failed';
      }

    } catch (e) {
      console.error(e);
      this.uploading = false;
      this.uploadStatus = 'Upload Failed';
      this.showUploadModal = true;
    }
  }
  // ---------- END UPLOAD ----------

  private async uploadSingleFile(
    file: File,
    index: number,
    totalFiles: number
  ): Promise<'success' | 'failed'> {
    try {
      let mediaType: 'video' | 'audio' | 'image' = 'video';
      if (file.type.startsWith('image/')) mediaType = 'image';
      else if (file.type.startsWith('audio/')) mediaType = 'audio';

      const videoPath = `media/${mediaType}/${Date.now()}_${file.name}`;
      const videoRef = ref(this.storage, videoPath);

      let thumbnailUrl: string | null = null;
      let durationSeconds: number | null = null;

      if (mediaType === 'video') {
        const videoElement = document.createElement('video');
        videoElement.preload = 'metadata';
        videoElement.src = URL.createObjectURL(file);

        await new Promise<void>((resolve) => {
          const failTimer = setTimeout(() => {
            console.warn('Thumbnail generation timed out. Skipping thumbnail.');
            clearTimeout(failTimer);
            resolve();
          }, 3000);

          videoElement.onloadedmetadata = () => {
            if (isFinite(videoElement.duration)) {
              durationSeconds = videoElement.duration;
            }
            videoElement.currentTime = 1;
          };

          videoElement.onseeked = () => {
            clearTimeout(failTimer);
            resolve();
          };

          videoElement.onerror = () => {
            clearTimeout(failTimer);
            resolve();
          };
        });

        if (videoElement.videoWidth && videoElement.videoHeight) {
          const canvas = document.createElement('canvas');
          canvas.width = 480;
          canvas.height = (480 / videoElement.videoWidth) * videoElement.videoHeight;

          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

          const thumbnailBlob: Blob | null = await new Promise(resolve =>
            canvas.toBlob(resolve as any, 'image/jpeg', 0.9)
          );

          if (thumbnailBlob) {
            const thumbPath = `thumbnails/${Date.now()}_thumb.jpg`;
            const thumbRef = ref(this.storage, thumbPath);
            try {
              await uploadBytes(thumbRef, thumbnailBlob);
              thumbnailUrl = await getDownloadURL(thumbRef);
            } catch {
              thumbnailUrl = null;
            }
          }
        }

        URL.revokeObjectURL(videoElement.src);

      } else if (mediaType === 'image') {
        const img = new Image();
        img.src = URL.createObjectURL(file);

        await new Promise<void>((resolve) => {
          const failTimer = setTimeout(() => {
            console.warn('Image thumbnail timed out. Skipping thumbnail.');
            clearTimeout(failTimer);
            resolve();
          }, 3000);

          img.onload = () => {
            clearTimeout(failTimer);
            resolve();
          };
          img.onerror = () => {
            clearTimeout(failTimer);
            resolve();
          };
        });

        if (img.naturalWidth && img.naturalHeight) {
          const maxWidth = 480;
          const scale = maxWidth / img.naturalWidth;
          const canvas = document.createElement('canvas');
          canvas.width = maxWidth;
          canvas.height = img.naturalHeight * scale;

          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          const thumbnailBlob: Blob | null = await new Promise(resolve =>
            canvas.toBlob(resolve as any, 'image/jpeg', 0.9)
          );

          if (thumbnailBlob) {
            const thumbPath = `thumbnails/${Date.now()}_thumb.jpg`;
            const thumbRef = ref(this.storage, thumbPath);
            try {
              await uploadBytes(thumbRef, thumbnailBlob);
              thumbnailUrl = await getDownloadURL(thumbRef);
            } catch {
              thumbnailUrl = null;
            }
          }
        }

        URL.revokeObjectURL(img.src);

      } else if (mediaType === 'audio') {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.src = URL.createObjectURL(file);

        await new Promise<void>((resolve) => {
          const failTimer = setTimeout(() => {
            clearTimeout(failTimer);
            resolve();
          }, 3000);

          audio.onloadedmetadata = () => {
            clearTimeout(failTimer);
            if (isFinite(audio.duration)) {
              durationSeconds = audio.duration;
            }
            URL.revokeObjectURL(audio.src);
            resolve();
          };

          audio.onerror = () => {
            clearTimeout(failTimer);
            URL.revokeObjectURL(audio.src);
            resolve();
          };
        });

        thumbnailUrl = this.audioIconDataUrl;
      }

      const metadata = {
        contentType: file.type,
        contentDisposition: `attachment; filename="${file.name}"`
      };

      const uploadTask = uploadBytesResumable(videoRef, file, metadata);

      const timeoutId = setTimeout(() => {
        if (this.uploading) {
          console.warn('HARD TIMEOUT: Upload froze.');
          uploadTask.cancel();
        }
      }, 20000);

      let lastBytes = 0;
      const freezeTimer = setInterval(() => {
        if (!this.uploading) return;

        const current = uploadTask.snapshot.bytesTransferred;
        if (current === lastBytes) {
          console.warn('Upload frozen — cancelling manually.');
          clearInterval(freezeTimer);
          clearTimeout(timeoutId);
          uploadTask.cancel();
        }
        lastBytes = current;
      }, 5000);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (!this.uploading) return;

            const fileFraction =
              snapshot.totalBytes > 0
                ? snapshot.bytesTransferred / snapshot.totalBytes
                : 0;

            const overall =
              ((index + fileFraction) / totalFiles) * 100;

            this.uploadProgress = Math.round(overall);
          },
          (err) => {
            clearTimeout(timeoutId);
            clearInterval(freezeTimer);
            console.error(err);
            reject(err);
          },
          () => {
            clearTimeout(timeoutId);
            clearInterval(freezeTimer);
            // snap exactly to the end of this file's portion
            this.uploadProgress = Math.round(((index + 1) / totalFiles) * 100);
            resolve();
          }
        );
      });

      const videoUrl = await getDownloadURL(uploadTask.snapshot.ref);
      const duration = this.formatDurationSeconds(durationSeconds);

      await addDoc(collection(this.firestore, 'videos'), {
        title: file.name,
        videoUrl,
        thumbnailUrl,
        videoPath,
        size: file.size,
        createdAt: serverTimestamp(),
        visibility: 'visible',
        mediaType,
        duration,
      });

      return 'success';
    } catch (e) {
      console.error('Single file upload failed', e);
      throw e; // so caller can see permission-denied
    }
  }

  clearFilters() {
    this.searchTerm = '';
    this.visibilityFilter = '';
    this.dateFilter = null;
  }

  onView(v: Video) {
    window.open(v.videoUrl, '_blank');
  }

  onEdit(v: Video) {
    this.editing = true;
    this.editData = { ...v };
  }

  async saveEdit() {
    if (!this.editData.id) return;
    const docRef = doc(this.firestore, `videos/${this.editData.id}`);
    await updateDoc(docRef, {
      title: this.editData.title,
      description: this.editData.description || '',
      visibility: this.editData.visibility || 'visible',
    });
    this.editing = false;
  }

  cancelEdit() {
    this.editing = false;
  }

  openDeleteDialog(v: Video) {
    this.confirmDeleteVideo = v;
  }

  cancelDelete() {
    this.confirmDeleteVideo = null;
  }

  // ---------- DELETE WITH UNAUTHORIZED MODAL ----------
  async confirmDelete() {
    const v = this.confirmDeleteVideo;
    if (!v) return;
    this.confirmDeleteVideo = null;

    try {
      const trashCol = collection(this.firestore, 'videos_deleted');
      const data: any = { ...v, deletedAt: serverTimestamp() };
      delete data.id;

      try {
        await addDoc(trashCol as any, data);
      } catch (err: any) {
        if (err?.code === 'permission-denied') {
          this.unauthorizedMessage = 'Only authorized users can delete videos.';
          return;
        }
        throw err;
      }

      if (v.id) {
        try {
          await deleteDoc(doc(this.firestore, `videos/${v.id}`));
        } catch (err: any) {
          if (err?.code === 'permission-denied') {
            this.unauthorizedMessage = 'Only authorized users can delete videos.';
            return;
          }
          throw err;
        }

        this.selectedIds.delete(v.id);
      }
    } catch (err) {
      console.error('Move to bin failed', err);
    }
  }
  // ---------- END DELETE ----------

  async bulkMoveToBin(videos: Video[]) {
    if (!this.selectedIds.size) return;

    const trashCol = collection(this.firestore, 'videos_deleted');
    const selectedVideos = videos.filter(v => v.id && this.selectedIds.has(v.id));

    for (const v of selectedVideos) {
      if (!v.id) {
        console.warn('Skipping video without id in bulk move:', v);
        continue;
      }

      try {
        console.log('Bulk move → bin:', v.id, v.title);

        const data: any = {
          ...v,
          deletedAt: serverTimestamp(),
        };
        delete data.id;

        await addDoc(trashCol, data);

        const videoDocRef = doc(this.firestore, 'videos', v.id);
        await deleteDoc(videoDocRef);

        this.selectedIds.delete(v.id);
      } catch (err) {
        console.error('Bulk move failed for', v.id, err);
        const msg = (err as any)?.message ?? JSON.stringify(err);
        alert(`Bulk move failed for ${v.title}: ${msg}`);
      }
    }
  }

  onExport() {
    this.videos$.pipe(map(list => list || [])).subscribe(list => {
      const rows = list.map(v => ({
        title: v.title,
        description: v.description || '',
        url: v.videoUrl,
        created: v.createdAt?.toDate?.().toISOString?.() || '',
        mediaType: v.mediaType || 'video',
        duration: v.duration || '',
      }));
      const csv = [
        Object.keys(rows[0] || {}).join(','),
        ...rows.map(r =>
          Object.values(r)
            .map(val => `"${String(val).replace(/"/g, '""')}"`)
            .join(',')
        ),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'media_export.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  setSort(mode: 'az' | 'za' | 'newest' | 'oldest' | '') {
    this.sortMode = mode;
  }

  prevPage() { if (this.page > 1) this.page--; }
  nextPage() { this.page++; }

  onGoToUpload() {
    const uploadEl = document.querySelector('app-upload');
    if (uploadEl) uploadEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  isAuthorized(): boolean {
    
    return false;
  }

  async download(v: Video) {
    try {
      const response = await fetch(v.videoUrl);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = v.title || 'download';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
    }
  }
}
