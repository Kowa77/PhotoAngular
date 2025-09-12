import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-failure',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './failure.component.html',
  styleUrls: ['./failure.component.css']
})
export class FailureComponent {
  constructor(private router: Router) {  }

  goToCarrito(): void {
      this.router.navigate(['/carrito']);
  }


}


