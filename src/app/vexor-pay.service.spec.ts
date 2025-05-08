import { TestBed } from '@angular/core/testing';

import { VexorPayService } from './vexor-pay.service';

describe('VexorPayService', () => {
  let service: VexorPayService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VexorPayService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
