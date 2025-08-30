import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';



@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule], // Necesario para *ngIf, *ngFor y el pipe async
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.css']
})
export class GalleryComponent {


}
