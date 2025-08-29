import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-gallery',
  standalone: true,
  templateUrl: './gallery.component.html',
  styleUrls: ['./gallery.component.css']
})
export class GalleryComponent implements OnInit {

  public galleryHtml: SafeHtml | undefined;

  constructor(private sanitizer: DomSanitizer) { }

  ngOnInit(): void {
    const embedCode = `
      <div class="pa-gallery-player-widget" style="width:100%; height:480px; visibility:hidden;"
        data-id="cQDetdQk9U4P5ttGA" data-link="https://photos.app.goo.gl/cQDetdQk9U4P5ttGA">
      </div>
    `;
    this.galleryHtml = this.sanitizer.bypassSecurityTrustHtml(embedCode);
  }
}
