import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  deleteDoc,
  addDoc,
  serverTimestamp,
  getDocs
} from '@angular/fire/firestore';
import { Storage, ref, deleteObject } from '@angular/fire/storage';
import { Observable } from 'rxjs';

interface TrashVideo {
  id?: string;
  title: string;
  thumbnailUrl?: string;
  videoPath?: string;
  deletedAt?: any;
  videoUrl: string;
}

@Component({
  selector: 'app-recycle-bin',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bin-wrapper">
      <div class="bin-header">
        <h2>Recycle Bin</h2>

        <button 
          *ngIf="trashLength > 0"
          class="btn-danger empty-btn"
          (click)="showEmptyConfirm = true">
          🗑 Empty Bin
        </button>
      </div>

      <div *ngIf="trash$ | async as trash">

        <p *ngIf="trash.length === 0">Recycle Bin is empty.</p>

        <table class="bin-table" *ngIf="trash.length > 0">
          <thead>
            <tr>
              <th>Thumb</th>
              <th>Title</th>
              <th>Deleted</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            <tr *ngFor="let v of trash">
              <td><img [src]="v.thumbnailUrl" class="thumb"/></td>
              <td>{{ v.title }}</td>
              <td>{{ v.deletedAt?.toDate() | date:'dd MMM yyyy' }}</td>
              <td>
                <button class="btn-secondary" (click)="restoreConfirm = v">⟲ Restore</button>
                <button class="btn-danger" (click)="deleteForeverConfirm = v">🗑 Delete Forever</button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- DELETE FOREVER CONFIRM -->
        <div class="modal-backdrop" *ngIf="deleteForeverConfirm">
          <div class="modal">
            <h3>Delete forever?</h3>
            <p>"{{ deleteForeverConfirm.title }}" will be permanently removed.</p>
            <div class="modal-actions">
              <button class="btn-secondary" (click)="deleteForeverConfirm = null">Cancel</button>
              <button class="btn-danger" (click)="confirmDeleteForever()">Delete Forever</button>
            </div>
          </div>
        </div>

        <!-- RESTORE CONFIRM -->
        <div class="modal-backdrop" *ngIf="restoreConfirm">
          <div class="modal">
            <h3>Restore this video?</h3>
            <p>"{{ restoreConfirm.title }}" will be moved back to Videos.</p>
            <div class="modal-actions">
              <button class="btn-secondary" (click)="restoreConfirm = null">Cancel</button>
              <button class="btn-primary" (click)="confirmRestore()">Restore</button>
            </div>
          </div>
        </div>

        <!-- EMPTY BIN CONFIRM -->
        <div class="modal-backdrop" *ngIf="showEmptyConfirm">
          <div class="modal">
            <h3>Empty Recycle Bin?</h3>
            <p>This will permanently delete all items. This action cannot be undone.</p>

            <div class="modal-actions">
              <button class="btn-secondary" (click)="showEmptyConfirm = false">Cancel</button>
              <button class="btn-danger" (click)="confirmEmptyBin()">Empty</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .bin-wrapper {
      padding: 10px;
      margin-top: -60px;
    }

    .bin-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .empty-btn {
      padding: 8px 16px;
      font-size: 14px;
      border-radius: 8px;
    }

   .bin-table {
  width: 100%;
  table-layout: fixed;       /* ensures perfect alignment */
  border-collapse: collapse;
  background: #ffffff;
  border-radius: 10px;
  overflow: hidden;
}

.bin-table th,
.bin-table td {
  padding: 12px;
  text-align: left;
  vertical-align: middle;
  border-bottom: 1px solid #e5e7eb;
}

/* Thumb column */
.bin-table th:nth-child(1),
.bin-table td:nth-child(1) {
  width: 90px;     /* enough for 70x45 thumbnail */
  text-align: center;
}

/* Title */
.bin-table th:nth-child(2),
.bin-table td:nth-child(2) {
  width: 45%;
  word-break: break-word;
}

/* Deleted date */
.bin-table th:nth-child(3),
.bin-table td:nth-child(3) {
  width: 20%;
  text-align: center;
}

/* Actions */
.bin-table th:nth-child(4),
.bin-table td:nth-child(4) {
  width: 180px;
  text-align: center;
  white-space: nowrap;
}

    .thumb {
      width: 70px;
      height: 45px;
      object-fit: cover;
      border-radius: 6px;
    }

    button {
      padding: 6px 10px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
    }

    .btn-secondary {
      background: #e5e7eb;
      font-weight: 600;
    }

    .btn-danger {
      background: #ef4444;
      color: white;
      font-weight: 600;
    }

    .btn-primary {
      background: #2563eb;
      color: white;
      font-weight: 600;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 50;
    }
      .modal p {
  word-wrap: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  max-width: 100%;
}


    .modal {
      background: white;
      padding: 20px 40px;
      border-radius: 12px;
      width: 320px;
      box-shadow: 0 10px 35px rgba(0,0,0,0.25);
      
    }

    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 20px;
    }
  `]
})
export class RecycleBinComponent {

  restoreConfirm: TrashVideo | null = null;
  deleteForeverConfirm: TrashVideo | null = null;

  showEmptyConfirm = false;
  trashLength = 0;

  firestore = inject(Firestore);
  storage = inject(Storage);

  trash$: Observable<TrashVideo[]> = collectionData(
    collection(this.firestore, 'videos_deleted'),
    { idField: 'id' }
  ) as Observable<TrashVideo[]>;

  constructor() {
    this.trash$.subscribe(list => {
      this.trashLength = list.length;
    });
  }

  async confirmRestore() {
    if (!this.restoreConfirm) return;
    const v = this.restoreConfirm;

    try {
      await deleteDoc(doc(this.firestore, `videos_deleted/${v.id}`));

      const { id, ...dataRest } = v;
      await addDoc(collection(this.firestore, 'videos'), {
        ...dataRest,
        restoredAt: serverTimestamp(),
      });

    } catch (err) {
      console.error('Restore failed', err);
    }

    this.restoreConfirm = null;
  }

  async confirmDeleteForever() {
    if (!this.deleteForeverConfirm) return;
    const v = this.deleteForeverConfirm;

    try {
      if (v.videoPath) {
        try { await deleteObject(ref(this.storage, v.videoPath)); } catch {}
      }

      await deleteDoc(doc(this.firestore, `videos_deleted/${v.id}`));

    } catch (err) {
      console.error('Delete forever failed', err);
    }

    this.deleteForeverConfirm = null;
  }

  // -------------------------------------------------
  // 🔥 FIXED: WORKING EMPTY BIN FUNCTION
  // -------------------------------------------------
  async confirmEmptyBin() {
    this.showEmptyConfirm = false;

    const trashCol = collection(this.firestore, 'videos_deleted');
    const snapshot = await getDocs(trashCol);

    for (const item of snapshot.docs) {
      const data = item.data() as TrashVideo;

      // delete actual file
      if (data.videoPath) {
        try { await deleteObject(ref(this.storage, data.videoPath)); } catch {}
      }

      // delete Firestore document
      await deleteDoc(doc(this.firestore, `videos_deleted/${item.id}`));
    }
  }
}
