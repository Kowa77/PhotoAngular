import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Importa CommonModule si lo necesitas

@Component({
  selector: 'app-casamientos',
  imports: [CommonModule], // Agrega NavbarComponent aquí
  templateUrl: './casamientos.component.html',
  styleUrl: './casamientos.component.css'
})
export class CasamientosComponent  implements OnInit{


  fotosCasamiento: string[] = [
    'https://cdn0.casamiento.com.uy/article-vendor/1548/3_2/1280/jpg/civil-jj-158_16_1548-162922634073701.webp',
    'https://cdn0.casamientos.com.ar/article-vendor/6224/3_2/960/jpg/foto-954_7_116224-168070784357425.webp',
    'https://media.istockphoto.com/id/1399000012/es/foto/invitados-arrojando-confeti-sobre-los-novios-mientras-pasan-despu%C3%A9s-de-su-ceremonia-de-boda.jpg?s=612x612&w=0&k=20&c=1rjbAjteSCKO3kiHGjz9DiQjqTbUSRPvNzUKLWNJqk8=',
    'https://cdn0.casamiento.com.uy/vendor/0113/3_2/960/jpg/fotografo-de-bodas-en-uruguay-7-1-1024x684_16_113-160883374190376.jpeg',
    'https://cdn0.casamientos.com.ar/article-vendor/0769/3_2/960/jpg/img-6304_7_150769-162006775071758.webp',
    'https://scontent.fmvd2-2.fna.fbcdn.net/v/t1.6435-9/87195848_3752501031457000_2998457582919614464_n.jpg?stp=dst-jpg_p526x395_tt6&_nc_cat=111&ccb=1-7&_nc_sid=3a1ebe&_nc_ohc=C3uvfqUu30AQ7kNvwFttuYO&_nc_oc=AdnGoEAN6chrfPbmEYBfdSx3yr93UILi0wCAbtYIg6zPXlagdZijSstpuB6BrytZw9_-zzwbHAh3-ZlEyYNbwz7t&_nc_zt=23&_nc_ht=scontent.fmvd2-2.fna&_nc_gid=9YhIRgMJ57jLYRuVCOebxw&oh=00_AfKRHPFdZaWEsjA0NhrYGPSN0GqNzA-2ju4ky9V4_9t-Dg&oe=684A59DD'

    // Reemplaza estas URLs con las URLs reales de tus fotos
  ];


 ngOnInit(): void {
    // Initialize any necessary properties or perform setup tasks
    console.log('CasamientosComponent initialized');
 }

 constructor() {
  // Constructor logic if needed
  // You can inject services here if necessary
 }

  // Aquí puedes agregar métodos para manejar la lógica de tu componente
  // Por ejemplo, si necesitas cargar fotos desde un servicio o API, puedes hacerlo aquí
  // loadPhotos() {
  //   // Lógica para cargar fotos
  // }

}

